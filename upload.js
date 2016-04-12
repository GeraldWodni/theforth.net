// package upload module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
// Note: as 'package' is a reserved keyword, we will be using the name 'packet' in javascript scope
"use strict";

var _       = require('underscore');
var async   = require('async');
var multer  = require('multer');
var fs      = require('fs');
var mkdirp  = require('mkdirp');
var mysql   = require("mysql");
var path    = require('path');
var stream  = require('stream');
var targz   = require('tar.gz');
var util    = require('util');
var unzip   = require('unzip');
var git	    = require('./git');

var forthParser = require("./forthParser");

module.exports = {
    setup: function( k ) {

        /* keys required in every package.4th-file */
        var requiredKeys = [ "name", "version", "license" ];
        /* keys optional for package.4th-files */
        var optionalKeys = [ "main", "description" ];
        /* list optional for package.4th-files */
        var optionalLists = [ "tags", "dependencies" ];

        /* maximum package size (in bytes) */
        var maxFileSize = 16 * 1024 * 1024;

        /* default jade value helper */
        var vals = k.setupOpts.vals;

        /* create single file upload handler */
        var memoryStorage =  multer.memoryStorage();
        var upload = multer({
            storange: memoryStorage,
            limits: {
                fileSize: maxFileSize
            }
        });

        function validName( name ) {
            return  /^[a-z]+[-a-z0-9]*$/gi.test( name );
        }

        function validWildcardVersion( version ) {
            return  /^\d{1,3}\.\d{1,3}\.(\d{1,3}|x)$/g.test( version )
                ||  /^\d{1,3}\.(\d|x)\.x$/g.test( version )
                ||  /^(\d|x)\.x\.x$/g.test( version );
        }

        function validVersion( version ) {
            return  /^\d{1,3}\.\d{1,3}\.\d{1,3}$/g.test( version );
        }

        function versionToInt( version ) {
            var value = 0;
            version.split( /\./g ).forEach( function( v ) {
                value *= 1000;
                value += Number(v);
            });
            return value;
        }

        function intToVersion( value ) {
            var version = '';
            var separator = '';
            for( var i = 0; i < 3; i++ ) {
                var part = value % 1000;
                version = part + separator + version;
                value -= part;
                value /= 1000;
                separator = '.';
            }
        }


        function symlink( destination, pathname, callback ) {
            fs.unlink( pathname, function() {
                fs.symlink( destination, pathname, callback );
            });
        }

        /* handle file upload */
        k.router.post("/upload", upload.single("file"), function( req, res ) {
            /* turn buffer into stream */
            var inputStream = new stream.PassThrough();
            var inputType = path.extname( req.file.originalname ).toLowerCase() === ".zip" ? "zip" : "tar.gz";
            inputStream.end( req.file.buffer );
            console.log( "UPLOAD".bold.yellow, inputType );

            /* parse .tar.gz */
            var messages = [];
            var hideForm = false;
            var packet = { directories: [], files: {} };
            var rootDirectory = null;
            var packetFile = null;

            /* render website */
            var render = function _render() {
                /* no errors? -> show success and hide form */
                if( _.filter( messages, function( message ) { return message.type == "danger" } ).length == 0 ) {
                    hideForm = true;
                    messages.push( { type: "success", title: "Great!", text: "Your new package is online" } );
                }

                k.jade.render( req, res, "addPackage", vals( req, { title: "Add package", messages: messages, hideForm: hideForm } ) );
            };

            /* save package */
            var save = function _save( keyValues, keyLists ) {
                if( _.filter( messages, function( message ) { return message.type == "danger" } ).length > 0 )
                    return render();

                var db = k.getDb();
                var updatePacket = {};
                var updateTags = [];
                var dependencies = [];

                /* get prefixes */
                var packetsPrefix = path.join( k.hierarchyRoot( req.kern.website ), "package" );
                var prefix = path.join( packetsPrefix, keyValues.name );
                var versionPrefix = path.join( prefix, keyValues.version );
                async.series([
                    /* check if name is already taken */
                    function _UploadSqlCheckName( done ) {
                        db.query("LOCK TABLES `packages` WRITE, `packageDependencies` WRITE, `tagNames` WRITE, `packageTags` WRITE; SELECT EXISTS(SELECT 1 FROM `packages` WHERE `name`=? AND `user`<>?) AS `exists`",
                            [ keyValues.name, req.user.id ], function( err, rows ) {

                            if( err )
                                done( err );
                            else if( rows[1][0].exists )
                                done( new Error( "Package name already in use by another user" ) );
                            else
                                done();
                        });
                    },
                    /* check dependencies */
                    function _CheckDependencies( done ) {
                        /* parse dependencies and check format */
                        var dependenciesList = keyLists.dependencies || [];
                        var dependencyNames = [ keyValues.name ];
                        for( var i = 0; i < dependenciesList.length; i++ ) {
                            var dependency = dependenciesList[i].split(" ");
                            if( dependency.length != 2 )
                                return done( new Error( "Dependency malformed. Use name-version pairs" ) );
                            if( !validName( dependency[0] ) )
                                return done( new Error( "Dependency name format invalid. Use a valid, existing packet reference" ) );
                            if( dependencyNames.indexOf( dependency[0] ) >= 0 )
                                return done( new Error( "Dependency repeated. Every dependency can only be referenced once" ) );
                            if( !validWildcardVersion( dependency[1] ) )
                                return done( new Error( "Dependency version format invalid. Use 3 decimal numbers ranging from 0-999 separated by dots i.e. >0.1.2<") );
                            dependencyNames.push( dependency[0] );
                            dependencies.push( { name: dependency[0], version: dependency[1] } );
                        }

                        /* check if dependencies exist */
                        async.mapSeries( dependencies, function( dependency, d ) {
                            fs.stat( path.join( packetsPrefix, dependency.name, dependency.version ), function( err ) {
                                if( err )
                                    d( new Error( "Dependency not found: " + dependency.name + " " + dependency.version ) );
                                else
                                    d();
                            });
                        }, done );
                    },
                    /* prevent overwrite */
                    function _UploadOverwriteProtection( done ) {
                        var versionDir = path.join( prefix, keyValues.version );
                        fs.stat( versionDir, function( err, stat ) {
                            /* exists -> error */
                            if( err == null )
                                done( new Error( "Package version already uploaded" ) );
                            /* new -> resume */
                            else if( err.code == 'ENOENT' )
                                done();
                            else
                                done( err );
                        });
                    },
                    /* create folders */
                    function _createDirectories( done ) {
                        async.mapSeries( packet.directories, function( dir, d ) {
                            dir = path.join( versionPrefix, dir.substr( keyValues.name.length ) );
                            console.log( "DIR:", dir );
                            mkdirp( dir, { mode: parseInt( "0775", 8 ) },  d );
                        }, done );
                    },
                    /* create files */
                    function _writeFiles( done ) {
                        async.mapSeries( _.keys( packet.files ), function( filepath, d ) {
                            var file = packet.files[ filepath ];
                            filepath = path.join( versionPrefix, file.path.substr( keyValues.name.length ) );
                            console.log( "FILE:", filepath );
                            fs.writeFile( filepath, file.content, d );
                        }, done);
                    },
                    /* write versions */
                    function _writeVersions( done ) {
                        var versionsPath = path.join( prefix, "versions" );
                        fs.stat( versionsPath, function( err, stat ) {
                            /* exists */
                            if( err == null )
                                fs.appendFile( versionsPath, "\n" + keyValues.version, done );
                            /* new */
                            else if( err.code == 'ENOENT' )
                                fs.writeFile( versionsPath, keyValues.version, done );
                            else
                                done( err );
                        });
                    },
                    /* write recent version */
                    function _writeRecentVersion( done ) {
                        var recentPath = path.join( prefix, "recent-version" );
                        fs.writeFile( recentPath, keyValues.version, function( err ) {
                            if( err ) return done( err );
                            symlink( keyValues.version, path.join( prefix, "recent" ), done );
                        });
                    },
                    /* update current */
                    function _updateCurrent( done ) {
                        var currentPath = path.join( prefix, "current-version" );
                        var currentWildcardPath = path.join( prefix, "x.x.x-version" );

                        var writeCurrent = function _writeCurrent(){
                            /* update sql */
                            updatePacket.description = keyValues.description || '';

                            //(keyValues.tags || '').split(/,/g).forEach( function( tag ) {
                            (keyLists.tags || []).forEach( function( tag ) {
                                var tag = tag.toLowerCase().replace( /[^-_.a-z0-9]/g, '' );
                                if( tag.length > 0 )
                                    updateTags.push( tag );
                            });

                            /* current */
                            fs.writeFile( currentPath, keyValues.version, function( err ) {
                                if( err ) return done( err );
                                symlink( keyValues.version, path.join( prefix, "current" ), function( err ) {
                                    if( err ) return done( err );

                                    /* wildcard */
                                    fs.writeFile( currentWildcardPath, keyValues.version, function( err ) {
                                        symlink( keyValues.version, path.join( prefix, "x.x.x" ), done );
                                    });

                                });
                            });
                        };

                        fs.readFile( currentPath, function( err, content ) {
                            /* exists */
                            if( err == null ) {
                                /* newer? */
                                if( versionToInt( keyValues.version ) > versionToInt( content + "" ) )
                                    writeCurrent();
                                else
                                    done();
                            }
                            /* new */
                            else if( err.code == 'ENOENT' )
                                writeCurrent();
                            else
                                done( err );
                        });
                    },
                    /* update N.x.x and N.M.x */
                    function _updateNMx( done ) {
                        console.log( "_updateNMx" );
                        var versionsPath = path.join( prefix, "versions" );
                        fs.readFile( versionsPath, function( err, content ) {
                            if( err ) return done( err );

                            var versionParts = keyValues.version.split( /\./g );
                            var versionInt = versionToInt( keyValues.version );
                            var versions = content.toString().split(/\n/g);
                            var N = versionParts[0];
                            var M = versionParts[1];
                            var NxxRe = new RegExp( '^' + N + '\\..*', 'g');
                            var NMxRe = new RegExp( '^' + N + '\\.' + M + '\\..*', 'g');
                            var maxNxx = versionInt;
                            var maxNMx = versionInt;

                            /* get maximum Nxx and NMx */
                            versions.forEach( function( version ) {
                                versionInt = versionToInt( version )
                                if( NxxRe.test( version ) && versionInt > maxNxx )
                                    maxNxx = versionInt;
                                if( NMxRe.test( version ) && versionInt > maxNMx )
                                    maxNMx = versionInt;
                            });

                            /* update symlink and file */
                            function updateUVx( UVx, callback ) {
                                console.log( "updateUVx", UVx );
                                fs.writeFile( path.join( prefix, UVx + "-version" ), keyValues.version, function( err ) {
                                    if( err ) return callback( err );
                                    symlink( keyValues.version, path.join( prefix, UVx ), callback );
                                });
                            }

                            function checkNxx( err ) {
                                console.log( "checkNxx", err );
                                if( err )
                                    return done( err );

                                if( maxNxx == versionInt )
                                    updateUVx( N + ".x.x", done );
                                else
                                    done();
                            }

                            /* check for update */
                            if( maxNMx == versionInt )
                                updateUVx( N + "." + M + ".x", checkNxx );
                            else
                                checkNxx();
                        });
                    },
                    /* fetch current description if none is set */
                    function _UploadSelectPackage( done ) {
                        db.query( "SELECT `description` FROM `packages` WHERE `name`=?", [ keyValues.name ], function( err, data ) {
                            if( err ) return done( err );
                            if( !_.has( updatePacket, 'description' ) )
                                if( data.length > 0 )
                                    updatePacket.description = data[0].description;
                                else
                                    updatePacket.description = '';

                            done();
                        });
                    },
                    /* insert/update sql-package */
                    function _UploadSql( done ) {
                        var now = new Date();

                        db.query("INSERT INTO `packages` SET ? ON DUPLICATE KEY UPDATE `id`=LAST_INSERT_ID(`id`), `changed`=NOW(), `description`=VALUES(`description`)",
                            [ _.extend( updatePacket, {
                                name: keyValues.name,
                                user: req.user.id,
                                created: now,
                                changed: now
                            })], function( err, packetRes ) {
                                if( err ) return done( err );

                                /* create and assign tags */
                                async.mapSeries( updateTags, function( tag, d ) {
                                    db.query("INSERT INTO `tagNames` (`name`) VALUES (?) ON DUPLICATE KEY UPDATE `id`=LAST_INSERT_ID(`id`)", [tag], function( err, tagRes ) {
                                        if( err ) return d( err );
                                        db.query("REPLACE INTO `packageTags` (`package`, `tag`) VALUES( ?, ? )", [ packetRes.insertId, tagRes.insertId ], d );
                                    });
                                }, function( err ) {
                                    if( err ) return done( err );

                                    /* insert dependencies */
                                    async.mapSeries( dependencies, function( dependency, d ) {
                                        db.query("INSERT INTO `packageDependencies` (`package`, `packageVersion`, `dependsOn`, `dependsOnVersion`) SELECT ?, ?, `id`, ? FROM `packages` WHERE `name`=?",
                                            [ packetRes.insertId, keyValues.version, dependency.version, dependency.name ], d );

                                    }, done);
                                });
                        });
                    }
                ], function( err ) {
                    console.log( "Series DONE!");
                    /* unlock tables under any circumstances */
                    db.query( "UNLOCK TABLES" );
                    if( err )
                        messages.push( { type: "danger", "title": "Save error", text: err.message } );
                    /* if all went well, background commit and push git */
                    else {
                        var sshDir = path.join( k.hierarchyRoot( req.kern.website ), "ssh" );
                        var packagePath = path.join( k.hierarchyRoot( req.kern.website ), "package" );
                        var commitMessage = keyValues.name + " " + keyValues.version + " (automated commit)";
                        git.addCommitPush( sshDir, packagePath, commitMessage, function( err, result ){
                            if( err )
                                console.log( "ERROR".bold.red, err );
                            else
                                console.log( "Git Pushed".bold.green );
                        })
                    }

                    render();
                });
            }

            /* parse stream */
            var parse;
            if( inputType == "zip" ) {
                parse = inputStream.pipe( unzip.Parse() );
            }
            else {
                parse = targz().createParseStream();
                inputStream.pipe(parse);
            }

            parse.on( "entry", function( entry ) {
                if( entry.type === "Directory" )
                    packet.directories.push( entry.path );
                else if( entry.type === "File" ) {
                    packet.files[ entry.path ] = entry;
                    entry.basename = path.basename( entry.path );
                    entry.dirname = path.dirname( entry.path );

                    /* feed buffer into content-array */
                    var chunks = [];
                    entry.on( "data", function( data ) {
                        chunks.push( data );
                    });
                    entry.on( "end", function( err ) {
                        if( err ) {
                            messages.push( { type: "danger", title: "tar.gz extract error:", text: err } );
                            entry.err = err;
                        }

                        var buffer = Buffer.concat( chunks );
                        entry.content = buffer;
                    });

                    /* count number of slashes in string */
                    var dirDepth = (entry.dirname.match(/\//g) || []).length + 1;

                    /* handle package.4th */
                    if( entry.basename == "package.4th" && dirDepth == 1 ) {
                        if( packetFile != null )
                            messages.push( { type: "danger", title: "multiple package.4th files:", text: "make sure you have only one root directory which contains package.4th" } );
                        else {
                            packetFile = entry;
                            rootDirectory = entry.dirname;
                        }
                    }
                }
            });
            parse.on( "error", function( err ) {
                messages.push( { type: "danger", title: "archive error", text: err } );
                render();
            });
            parse.on( "close", function() {
                /* check for package.4th */
                if( packetFile == null || packetFile.err ) {
                    messages.push( { type: "danger", title: "package.4th not found:", text: "include package.4th in the root directory of your archive" } );
                    return render();
                }

                /* parse package.4th */
                var stringStack = [];
                var keyValues = null;
                var keyLists = {};
                var completed = 0;

                var words = {
                    /* start package definition */
                    "forth-package": function() {
                        if( keyValues != null )
                            messages.push( { type: "danger", title: "package.4th syntax error:", text: "forth-package can only occur once" } );

                        /* enable dictionary */
                        /* push parsed string on stack */
                        //words['s"'] = function() {
                        //    stringStack.push( this.parse('"') );
                        //};
                        /* comments */
                        words["\\"] = function() {
                            this.parse();
                        };
                        words["("] = function() {
                            this.parse(")");
                        };
                        /* store key-value in array */
                        words["key-value"] = function() {
                            var key = this.parseName();
                            var val = this.parse();

                            if( key in keyValues )
                                messages.push( { type: "danger", title: "package.4th key-value redefined", text: "key-value >" + key + "< has already been defined" } );

                            keyValues[ key ] = val;
                        };
                        words["key-list"] = function() {
                            var key = this.parseName();
                            var val = this.parse();

                            var list = keyLists[ key ] || []
                            list.push( val );
                            keyLists[ key ] = list;
                        }

                        keyValues = {};
                        completed++;
                    },
                    /* end package definition */
                    "end-forth-package": function() {
                        if( keyValues == null )
                            messages.push( { type: "danger", title: "package.4th syntax error:", text: "forth-package has not been declared" } );
                        if( stringStack.length != 0 )
                            messages.push( { type: "danger", title: "package.4th semantical error:", text: "string stack not empty, please remove unnecessary strings" } );

                        /* disable dictionary */
                        delete words['\\'];
                        delete words['('];
                        delete words['key-value'];
                        delete words['key-list'];

                        console.log( "KeyValues:", keyValues, "KeyLists", keyLists );
                        completed++;
                    },
                    " ": function( word ) {
                        if( typeof word !== "undefined" ) {
                            messages.push( { type: "danger", title: "package.4th unknown word", text: ">" + word + "< has not been defined" } );
                            console.log( ("Unknown word >" + word + "<").red.bold );
                        }
                    }
                }

                /* run parser */
                forthParser( packetFile.content + "", words );

                /* check if package has been completed */
                if( completed != 2 )
                    messages.push( { type: "danger", title: "package.4th syntax error", text: "forth-package / end-forth-package construct not completed" } );

                /* check if all necessary key-value pairs are present */
                var definedKeys = _.keys( keyValues );
                var definedLists = _.keys( keyLists );

                requiredKeys.forEach( function( key ) {
                    if( _.contains( definedKeys, key ) )
                        definedKeys = _.without( definedKeys, key );
                    else
                        messages.push( { type: "danger", title: "package.4th missing key", text: ">" + key + "< is required" } );
                });

                optionalKeys.forEach( function( key ) {
                    if( _.contains( definedKeys, key ) )
                        definedKeys = _.without( definedKeys, key );
                });

                optionalLists.forEach( function( key ) {
                    if( _.contains( definedLists, key ) )
                        definedLists = _.without( definedLists, key );
                });

                /* write warnings for unknown keys */
                definedKeys.forEach( function( key ) {
                    messages.push( { type: "warning", title: "package.4th unknown key", text: ">" + key + "< is not part of the package.4th-standard, please try to avoid unnecessary keys" } );
                });

                /* write warnings for unknown lists */
                definedLists.forEach( function( key ) {
                    messages.push( { type: "warning", title: "package.4th unknown list", text: ">" + key + "< is not part of the package.4th-standard, please try to avoid unnecessary lists" } );
                });

                /* check if root-directory matches name */
                if( rootDirectory != keyValues["name"] )
                    messages.push( { type: "danger", title: "root directory name invalid", text: "root-directory needs to have the same name as defined in package.4th" });

                /* validate name format */
                if( keyValues.name && !validName( keyValues.name ) )
                    messages.push( { type: "danger", title: "package name invalid", text: "start with a letter followed by letters, numbers or minus" });

                /* validate version format */
                if( keyValues.version && ! validVersion( keyValues.version ) )
                    messages.push( { type: "danger", title: "version format invalid", text: "use 3 decimal numbers ranging from 0-999 separated by dots i.e. >0.1.2<" });

                /* all done, we have a valid package.4th */
                save( keyValues, keyLists );
            });
        });

        k.router.get("/upload", function( req, res ) {
            k.jade.render( req, res, "addPackage", vals( req, { title: "Add package", messages: [] } ) );
        });
    }
};

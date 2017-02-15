// package viewing module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
// Note: as 'package' is a reserved keyword, we will be using the name 'packet' in javascript scope
"use strict";

var _       = require('underscore');
var async   = require('async');
var JSZip   = require('jszip');
var fs      = require('fs');
var marked  = require('marked');
var md5     = require('md5');
var path    = require('path');

module.exports = {
    setup: function( k ) {

        /* default jade value helper */
        var vals = k.setupOpts.vals;

        var kData = k.getData();

        /* TODO: share this function with upload.js */
        function versionToInt( version ) {
            var value = 0;
            version.split( /\./g ).forEach( function( v ) {
                value *= 1000;
                value += Number(v);
            });
            return value;
        }

        /* markdown setup and post-processing */
        marked.setOptions({
            sanitize: true /* disable inline HTML */
        });

        function markdown( md, opts ) {
            opts = opts || {};
            var html = marked( md );
            html = html.replace( /<table>/g, '<table class="table">' );

            /* prefix local links */
            if( opts.prefixLinks )
                html = html.replace( /(src|href)="([^"]+)"/g, function(match, tag, link) {
                    /* do not replace global links */
                    if( link.indexOf( "\/\/" ) >= 0 )
                        return match;

                    link = path.join( opts.prefixLinks[tag], link );
                    return tag + '="' + link + '"';
                });

            return html;
        }

        function renderPacket( req, res, next, packetName, packetVersion, filepath ) {
            var db = k.getDb();

            var packetPath  = path.join( "package", packetName );
            var currentPath = path.join( packetPath, packetVersion );
            var values = { version: packetVersion }

            async.series([
                /* sql */
                function _readPacket( done ) {
                    db.query( "SELECT `packages`.*, GROUP_CONCAT( `tagNames`.`name` ) AS `tags`,"
                        + " GROUP_CONCAT(CONCAT(`dependencies`.`name`, ' ', `packageDependencies`.`dependsOnVersion`)) AS `dependencies`,"
                        + " GROUP_CONCAT(CONCAT(`dependents`.`name`, ' ', `packageDependents`.`packageVersion`)) AS `dependents`"
                        + " FROM `packages`"
                        + " LEFT JOIN `packageTags` ON `packages`.`id`=`packageTags`.`package`"
                        + " LEFT JOIN `tagNames`    ON `packageTags`.`tag`=`tagNames`.`id`"
                        + " LEFT JOIN `packageDependencies` ON `packages`.`id`=`packageDependencies`.`package`"
                        + " LEFT JOIN `packages` AS `dependencies` ON `packageDependencies`.`dependsOn`=`dependencies`.`id`"
                        + " LEFT JOIN `packageDependencies` AS `packageDependents` ON `packages`.`id`=`packageDependents`.`dependsOn`"
                        + " LEFT JOIN `packages` AS `dependents` ON `packageDependents`.`package`=`dependents`.`id`"
                        + " WHERE `packages`.`name` = ?"
                        + " GROUP BY `packages`.`id`"
                        , [ packetName ], function( err, packets ) {

                        if( err ) return done( err );
                        if( packets.length == 0 ) return k.httpStatus( req, res, 404 );
                        values.packet = packets[0];
                        done();
                    });
                },
                /* user */
                function _readUser( done ) {
                    kData.users.read( values.packet.user, function( err, user ) {
                        if( err ) return done( err );
                        user.emailMd5 = md5( user.email );
                        values.user = user;
                        done();
                    });
                },
                /* directory */
                function _readTree( done ) {
                    var filepath = k.hierarchy.lookupFile( req.kern.website, currentPath );
                    if( !filepath )
                        return done( new Error( "No Directory" ) );

                    k.hierarchy.readTree( { dirpath: filepath, prefix: "/package/" + values.packet.name + "/" + values.version }, function( err, tree ) {
                        if( err ) return done( err );
                        values.tree = tree;
                        done();
                    });
                },
                /* ReadMe */
                function _readMe( done ) {
                    values.viewFormat = 'none';
                    values.readmePath  = null;

                    /* file view requested, do not display readme */
                    if( filepath )
                        return done();

                    k.readHierarchyDir( req.kern.website, currentPath, function( err, items ) {
                        if( err ) return done( err );

                        var readmeMarkdownRe = /^read-?me\.(md|markdown)/i;
                        var readmeRe = /^read-?me/i;
                        values.viewContent = 'No Readme found';
                        for( var i = 0; i < items.length; i++ ) {
                            var item = items[i];
                            /* markdown found -> use it */
                            if( readmeMarkdownRe.test( item ) ) {
                                values.viewFormat = 'markdown';
                                values.readmePath = item;
                                break;
                            }
                            /* plain reame found, keep looking for better format */
                            if( readmeRe.test( item ) ) {
                                values.viewFormat = 'plain';
                                values.readmePath = item;
                            }
                        }
                        done();
                    });
                },
                /* check for linked content like images */
                function _linkedContent( done ) {
                    /* make sure a path was given */
                    if( !filepath )
                        return done();

                    /* local path -> url */
                    var linkpath = filepath.replace( /^websites\/theforth.net/, '' );
                    /* select renderer */
                    switch( path.extname( filepath ).toLowerCase() ) {
                        case '.png':
                        case '.gif':
                        case '.jpg':
                            values.viewFormat = 'image';
                            values.linkedContent = linkpath;
                            break;
                    }
                    done();
                },
                /* file-content */
                function _readMeContent( done ) {
                    /* view readme */
                    if( values.readmePath )
                        k.readHierarchyFile( req.kern.website, path.join( currentPath, values.readmePath ), function( err, content ) {
                            if( err ) return done( err );

                            /* convert */
                            if( values.viewFormat == 'markdown' )
                                values.viewContent = markdown( content[0], {
                                    prefixLinks: {
                                        href:   "/" + currentPath + "-view/",
                                        src:    "/" + currentPath + "/"
                                    }
                                } );
                            else
                                values.viewContent = content[0];
                            done();
                        });
                    /* linked file */
                    else if( values.linkedContent )
                        done();
                    /* view file */
                    else if( filepath ) {
                        fs.readFile( filepath, function( err, content ) {
                            values.viewContent = content;
                            switch( path.extname( filepath ).toLowerCase() ) {
                                case '':
                                case '.txt':
                                    values.viewFormat = 'txt';
                                    break;
                                case '.f':
                                case '.fs':
                                case '.4th':
                                case '.frt':
                                case '.fth':
                                    values.viewFormat = 'fs';
                                    break;
                                case '.md':
                                case '.markdown':
                                    values.viewFormat = 'markdown';
                                    values.viewContent = markdown( content + "" );
                                    break;
                                default:
                                    values.viewFormat = 'none';
                                    values.viewContent = 'Unknown file type, use raw-view';
                            }

                            done();
                        });
                    }
                    else {
                        done();
                    }
                },
                /* Versions-file */
                function _versions( done ) {
                    k.readHierarchyFile( req.kern.website, path.join( packetPath, "versions" ), function( err, content ) {
                        if( err ) return done( err );
                        values.versions = _.sortBy( content.toString().split(/\n/), function(v){ return -versionToInt(v) } );
                        done();
                    });
                }
            ], function( err ) {
                if( err && err.message === "No Directory" )
                    return k.httpStatus( req, res, 404 );

                if( err ) return next( err );

                /* render */
                values.title = values.packet.name;
                k.jade.render( req, res, "package", vals( req, values ) );
            });
        }

        function checkFile( req, res, callback ) {
            k.requestman( req );

            /* check path */
            var pathname = path.normalize( req.params[0] );
            if( pathname != req.params[0] || pathname.indexOf( ".." ) >= 0 )
                return k.httpStatus( req, res, 403 );

            /* send file or 404 */
            pathname = path.join( "package", req.requestman.id( "name" ), req.requestman.id( "version" ), pathname );
            var filepath = k.hierarchy.lookupFile( req.kern.website, pathname );
            if( filepath == null )
                k.httpStatus( req, res, 404 );
            else
                callback( filepath );
        }

        /* download zip */
        k.router.use( "/:name/:version([.a-z0-9]+).zip", function( req, res, next ) {

            function zipVersion( name, version, pathname ) {
                var pathname = k.hierarchy.lookupFile( req.kern.website, pathname );
                if( !pathname )
                    return next( new Error( "Unknown package-version combination" ) );

                /* packet hierarchy */
                k.hierarchy.readTree( { dirpath: pathname, prefix: pathname }, function( err, tree ) {
                    if( err ) return next( err );

                    function addDirectory( zipDir, treeDir, done ) {
                        /* add directories */
                        async.mapSeries( _.keys( treeDir.dirs ), function _handleDir( dirKey, d ) {
                            addDirectory( zipDir.folder( dirKey ), treeDir.dirs[ dirKey ], d );
                        }, function _handleFiles( err ) {
                            if( err ) return done( err );
                        /* add files */
                            async.mapSeries( treeDir.files, function( file, d ) {
                                fs.readFile( file.link, function( err, content ) {
                                    if( err ) return d( err );
                                    zipDir.file( file.name, content );
                                    d();
                                });

                            }, done);
                        });
                    }

                    /* finished, create and send zip */
                    var zip = new JSZip();
                    addDirectory( zip.folder( name ).folder( version ), tree, function( err ) {
                        res.setHeader('Content-Disposition', 'attachment; filename="' + name + "-" + version + '.zip"');
                        res.send(zip.generate({type:"nodebuffer"}));
                    });
                });
            }

            k.requestman( req );
            var name = req.requestman.id( "name" );
            var version = req.requestman.id( "version" );
            /* numerical version? */
            if( /^[0-9]+\.[0-9]+\.[0-9]+$/g.test( version ) )
                zipVersion( name, version, path.join( "package", name, version ) );
            /* read named version (if exists) */
            else
                k.readHierarchyFile( req.kern.website, path.join( "package", name, version + "-version" ), function( err, data ) {
                    if( err ) return next( err );
                    version = data[0] + "";
                    zipVersion( name, version, path.join( "package", name, version ) );
                });
        });

        /* view file */
        k.router.use( "/:name/:version-view/*", function( req, res, next ) {
            console.log("VIEW!");
            checkFile( req, res, function( filepath ) {
                renderPacket( req, res, next, req.requestman.id( "name" ), "current", filepath );
            });
        });

        /* raw file */
        k.router.use( "/:name/:version/*", function( req, res, next ) {
            checkFile( req, res, function( filepath ) {
                res.sendfile( filepath );
            });
        });

        /* specific version */
        k.router.use( "/:name/:version", function( req, res, next ) {
            k.requestman( req );
            renderPacket( req, res, next, req.requestman.id( "name" ), req.requestman.decimal( "version" ) );
        });

        /* current version */
        k.router.use( "/:name", function( req, res, next ) {
            k.requestman( req );
            renderPacket( req, res, next, req.requestman.id( "name" ), "current" );
        });
    }
};
        
        
        
        
        

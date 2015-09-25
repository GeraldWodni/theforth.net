// package viewing module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
// Note: as 'package' is a reserved keyword, we will be using the name 'packet' in javascript scope
"use strict";

var _       = require('underscore');
var async   = require('async');
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


        /* TODO: taken from media.js, put this into new kern-fs or media module */
        function readTree( opts, callback ) {
            var tree = { dirs: {}, files: [] };

            /* queue worker */
            var treeQueue = async.queue( function( task, next ) {

                /* directory contents */
                fs.readdir( task.dirpath, function( err, filenames ) {
                    if( err )
                        return next( err );

                    /* run stat for content */
                    async.mapSeries( filenames, function( filename, d ) {
                        var filepath = path.join( task.dirpath, filename );
                        fs.stat( filepath, function( err, stat ) {
                            if( err )
                                return d( err );

                            /* spawn new worker for every directory */
                            if( stat.isDirectory() ) {
                                var prefix = path.join( task.prefix, filename ); 
                                var newTree = { dirs: {}, files: [], prefix: task.prefix, path: prefix };
                                task.tree.dirs[ filename ] = newTree;
                                treeQueue.push( { dirpath: filepath, tree: newTree, prefix: prefix } );
                            }
                            /* just add file */
                            else {
                                var link = path.join( task.prefix, filename );
                                task.tree.files.push( { name: filename, link: link } );
                            }
                            d();
                        });
                    }, next );
                });
            });

            /* all done, callback */
            treeQueue.drain = function( err ) {
                callback( err, tree );
            };
            treeQueue.push( { dirpath: opts.dirpath, tree: tree, prefix: opts.prefix } );
        }

        function renderPacket( req, res, next, packetName, packetVersion, filepath ) {
            var db = k.getDb();

            var packetPath  = path.join( "package", packetName );
            var currentPath = path.join( packetPath, packetVersion );
            var values = { version: packetVersion }

            async.series([
                /* sql */
                function _readPacket( done ) {
                    db.query( "SELECT `packages`.*, GROUP_CONCAT( `tagNames`.`name` ) AS `tags` FROM `packages`"
                        + " LEFT JOIN `packageTags` ON `packages`.`id`=`packageTags`.`package`"
                        + " LEFT JOIN `tagNames`    ON `packageTags`.`tag`=`tagNames`.`id`"
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
                    readTree( { dirpath: filepath, prefix: "/package/" + values.packet.name + "/" + values.version }, function( err, tree ) {
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
                /* file-content */
                function _readMeContent( done ) {
                    /* view readme */
                    if( values.readmePath )
                        k.readHierarchyFile( req.kern.website, path.join( currentPath, values.readmePath ), function( err, content ) {
                            if( err ) return done( err );

                            /* convert */
                            if( values.viewFormat == 'markdown' )
                                values.viewContent = marked( content[0] );
                            else
                                values.viewContent = content[0];
                            done();
                        });
                    /* view file */
                    else if( filepath ) {
                        fs.readFile( filepath, function( err, content ) {
                            values.viewContent = content;
                            switch( path.extname( filepath ).toLowerCase() ) {
                                case '':
                                case '.txt':
                                    values.viewFormat = 'txt';
                                    break;
                                case '.fs':
                                    values.viewFormat = 'fs';
                                    break;
                                case '.md':
                                case '.markdown':
                                    values.viewFormat = 'markdown';
                                    values.viewContent = marked( content + "" );
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
        
        
        
        
        

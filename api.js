// rest api
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
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
        var kData = k.getData();

        function getType( req, next ) {
            k.requestman( req );
            var type = req.requestman.id("type");
            if( type != "text" && type != "json" && type != "forth" ) {
                next( new Error( "Unknown API-type, allowed: 'text' and 'json'" ) );
                return false;
            }

            return type;
        }

        function returnPlain( res, type, lines ) {
            var content = lines.join("\n");
            switch( type ) {
                case 'forth':
                    res.set('Content-Type', 'text/forth');
                    res.set('Content-Length', content.length );
                    res.end( content );
                    break;

                case 'text':
                    res.set('Content-Type', 'text/plain');
                    res.end( content );
                    break;
            }
        }

	function returnPackets( req, res, next, packets ) {
            
            var lines = [];
            var forth = [ "forth-packages" ];
            var json = [];
            packets.forEach( function( packet ) {
                lines.push( packet.name );
                forth.push( "name-description " + packet.name + " " + packet.description );
                json.push({
                    name:       packet.name,
                    description:packet.description,
                    created:    packet.created,
                    changed:    packet.changed,
                    url:        "http://theforth.net/package/" + packet.name
                });
            });

            switch( getType( req, next ) ) {
                case 'forth':
                    forth.push("end-forth-packages");
                    var content = forth.join("\n");
                    res.set('Content-Type', 'text/forth');
                    res.set('Content-Length', content.length );
                    res.end( content );
                    break;

                case 'text':
                    res.set('Content-Type', 'text/plain');
                    res.end( lines.join("\n") );
                    break;

                case 'json':
                    res.json( json );
                    break;
            }
	}

        /* search all packages */
        k.router.get("/api/packages/search/:type/:query", function( req, res, next ) {
            var type = getType( req, next );
            if( !type )
                return next(new Error( "No type submitted" ));

            var query = req.requestman.escapedLink("query");

            kData.packages.readWhere( "search", [ query, query ], function( err, packets ) {
                if( err ) return next( err );

                returnPackets( req, res, next, packets );
            });
        });

        /* list all packages */
        k.router.get("/api/packages/:type", function( req, res, next ) {
            var type = getType( req, next );
            if( !type )
                return next(new Error( "No type submitted" ));

            kData.packages.readAll( function( err, packets ) {
                if( err ) return next( err );

                returnPackets( req, res, next, packets );
            });
        });

        /*readme for package */
        k.router.get("/api/packages/info/:type/:name", function( req, res, next ) {
            var type = getType( req, next );
            /* TODO: type is currently ignored */
            if( !type )
                return next(new Error( "No type submitted" ));

            var name = req.requestman.id("name");
            var currentPath = path.join( "package", name, "current" );
            k.readHierarchyDir( req.kern.website, currentPath, function( err, items ) {
                if( err ) return next( err );

                var readmePath = "";
                var readmeRe = /^read-?me/i;
                for( var i = 0; i < items.length; i++ ) {
                    var item = items[i];
                    if( readmeRe.test( item ) ) {
                        var readmePath = item;
                        break;
                    }
                }

                if( !readmePath )
                    return next( new Error( "No ReadMe found" ) );

                k.readHierarchyFile( req.kern.website, path.join( currentPath, readmePath ), function( err, content ) {
                    if( err ) return next( err );
                    content = content[0];
                    res.set('Content-Type', 'text/plain');
                    res.set('Content-Length', content.length );
                    console.log( "CNTNT", content );
                    res.end( content );
                });

            });
        });

        /* download package */
        k.router.get("/api/packages/get/:type/:name/:version", function( req, res, next ) {
            var type = getType( req, next );
            if( !type )
                return next(new Error( "No type submitted" ));

            var name = req.requestman.id("name");
            var version = req.requestman.id("version");

            k.hierarchy.readHierarchyTree( req.kern.website, path.join( "package", name, version ), { prefix: path.join( "/package", name, version ) },
                function( err, tree ) {
                if( err ) return next( err );

                if( type == "json" )
                    return res.json( tree );

                /* recursivly read content */
                var forth = [];
                var lines = [];
                forth.push( "package-download " + name + " " + version );
                function readDir( node, prefix ) {
                    _.each( node.dirs, function( dirNode, name ) {
                        var dirpath = path.join( prefix, name );

                        forth.push( "directory " + dirpath );
                        lines.push( dirpath );

                        readDir( dirNode, path.join( prefix, name ) );
                    });

                    _.each( node.files, function( file ) {
                        var filepath = path.join( prefix, file.name );

                        forth.push( "file " + filepath + " " + file.link );
                        lines.push( filepath );
                    });
                }

                readDir( tree, "/" );
                forth.push( "end-package-download" );

                returnPlain( res, type, type == "forth" ? forth : lines );
            });
        });
    }
};

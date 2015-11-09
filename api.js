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

        k.router.get("/api/packages/:type", function(req, res, next ){
            var type = getType( req, next );

            if( type )
                kData.packages.readAll( function( err, packets ) {
                    if( err ) return next( err );

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
                });
        });
    }
};

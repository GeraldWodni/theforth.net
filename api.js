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

        k.router.get("/api/packages/text", function(req, res ){
            kData.packages.readAll( function( err, packets ) {
                if( err ) return next( err );

                var lines = [];
                packets.forEach( function( packet ) {
                    lines.push( packet.name );
                });

                res.set('Content-Type', 'text/plain');
                res.end( lines.join("\n") );
            });
        });
    }
};

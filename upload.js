// package upload module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require('underscore');
var asyn    = require('async');
var multer  = require('multer');
var fs      = require('fs');
var path    = require('path');
var util    = require('util');

module.exports = {
    setup: function( k ) {

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

        k.router.post("/upload", upload.single("file"), function( req, res ) {
            console.log( req.file.buffer + "" );

            k.jade.render( req, res, "addPackage", vals( req, { title: "Add package" } ) );
        });

        k.router.get("/upload", function( req, res ) {
            k.jade.render( req, res, "addPackage", vals( req, { title: "Add package" } ) );
        });
    }
};

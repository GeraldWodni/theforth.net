// package upload module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require('underscore');
var asyn    = require('async');
var multer  = require('multer');
var fs      = require('fs');
var path    = require('path');
var stream  = require('stream');
var targz   = require('tar.gz');
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


        /* handle file upload */
        k.router.post("/upload", upload.single("file"), function( req, res ) {
            console.log( "UPLOAD".bold.yellow );

            /* turn buffer into stream */
            var inputStream = new stream.PassThrough();
            inputStream.end( req.file.buffer );

            /* parse .tar.gz */
            var messages = [];
            var hideForm = false;
            var packet = { directories: [], files: {} };
            var parse = targz().createParseStream();
            parse.on( "entry", function( entry ) {
                if( entry.type === "Directory" )
                    packet.directories.push( entry.path );
                else if( entry.type === "File" ) {
                    packet.files[ entry.path ] = entry;
                }
            });
            parse.on( "end", function() {
                console.log( "Package".magenta.bold, packet );

                if( !packet.files["package.fs"] )
                    messages.push( { type: "danger", title: "package.fs not found:", text: "include package.fs in the root directory of your archive" } );

                /* no errors? -> show success and hide form */
                if( messages.length == 0 ) {
                    hideForm = true;
                    messages.push( { type: "success", title: "Great!", text: "Your new package is online" } );
                }

                k.jade.render( req, res, "addPackage", vals( req, { title: "Add package", messages: messages, hideForm: hideForm } ) );
            });
            inputStream.pipe(parse);
        });

        k.router.get("/upload", function( req, res ) {
            k.jade.render( req, res, "addPackage", vals( req, { title: "Add package" } ) );
        });
    }
};

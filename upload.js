// package upload module
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
// Note: as 'package' is a reserved keyword, we will be using the name 'packet' in javascript scope
"use strict";

var _       = require('underscore');
var async   = require('async');
var multer  = require('multer');
var fs      = require('fs');
var path    = require('path');
var stream  = require('stream');
var toArray = require('stream-to-array');
var targz   = require('tar.gz');
var util    = require('util');

var forthParser = require("./forthParser");

module.exports = {
    setup: function( k ) {

        /* keys required in every package.fs-file */
        var requiredKeys = [ "name", "version" ];
        /* keys optional for package.fs-files */
        var optionalKeys = [ "main" ];

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
            var rootDirectory = null;
            var packetFile = null;

            parse.on( "entry", function( entry ) {
                if( entry.type === "Directory" )
                    packet.directories.push( entry.path );
                else if( entry.type === "File" ) {
                    packet.files[ entry.path ] = entry;
                    entry.basename = path.basename( entry.path );
                    entry.dirname = path.dirname( entry.path );

                    /* feed buffer into content-array */
                    toArray( entry, function( err, arr ) {
                        if( err ) {
                            messages.push( { type: "danger", title: "tar.gz extract error:", text: err } );
                            entry.err = err;
                        }

                        entry.content = arr;
                    });

                    /* count number of slashes in string */
                    var dirDepth = (entry.dirname.match(/\//g) || []).length + 1;

                    /* handle package.fs */
                    if( entry.basename == "package.fs" && dirDepth == 1 ) {
                        if( packetFile != null )
                            messages.push( { type: "danger", title: "multiple package.fs files:", text: "make sure you have only one root directory which contains package.fs" } );
                        else {
                            packetFile = entry;
                            rootDirectory = entry.dirname;
                        }
                    }
                }
            });
            parse.on( "end", function() {
                console.log( "Package".magenta.bold, packet );

                var render = function() {
                    /* no errors? -> show success and hide form */
                    if( _.filter( messages, function( message ) { return message.type == "danger" } ).length == 0 ) {
                        hideForm = true;
                        messages.push( { type: "success", title: "Great!", text: "Your new package is online" } );
                    }

                    k.jade.render( req, res, "addPackage", vals( req, { title: "Add package", messages: messages, hideForm: hideForm } ) );
                };

                /* check for package.fs */
                if( packetFile == null || packetFile.err ) {
                    messages.push( { type: "danger", title: "package.fs not found:", text: "include package.fs in the root directory of your archive" } );
                    return render();
                }

                /* parse package.fs */
                var stringStack = [];
                var keyValues = null;
                var completed = 0;

                var words = {
                    /* start package definition */
                    "forth-package": function() {
                        if( keyValues != null )
                            messages.push( { type: "danger", title: "package.fs syntax error:", text: "forth-package can only occur once" } );

                        /* enable dictionary */
                        /* push parsed string on stack */
                        words['s"'] = function() {
                            stringStack.push( this.parse('"') );
                        };
                        /* store key-value in array */
                        words["key-value"] = function() {
                            var val = stringStack.pop();
                            var key = stringStack.pop();

                            if( key in keyValues )
                                messages.push( { type: "danger", title: "package.fs key-value redefined", text: "key-value >" + key + "< has already been defined" } );

                            keyValues[ key ] = val;
                        };

                        keyValues = {};
                        completed++;
                    },
                    /* end package definition */
                    "end-forth-package": function() {
                        if( keyValues == null )
                            messages.push( { type: "danger", title: "package.fs syntax error:", text: "forth-package has not been declared" } );
                        if( stringStack.length != 0 )
                            messages.push( { type: "danger", title: "package.fs semantical error:", text: "string stack not empty, please remove unnecessary strings" } );

                        /* disable dictionary */
                        delete words['s"'];
                        delete words['key-value'];

                        console.log( keyValues );
                        completed++;
                    },
                    " ": function( word ) {
                        messages.push( { type: "danger", title: "package.fs unknown word", text: ">" + word + "< has not been defined" } );
                        console.log( ("Unknown word >" + word + "<").red.bold );
                    }
                }

                /* run parser */
                forthParser( packetFile.content + "", words );

                /* check if package has been completed */
                if( completed != 2 )
                    messages.push( { type: "danger", title: "package.fs syntax error", text: "forth-package / end-forth-package construct not completed" } );

                /* check if all necessary key-value pairs are present */
                var definedKeys = _.keys( keyValues );

                requiredKeys.forEach( function( key ) {
                    if( _.contains( definedKeys, key ) )
                        definedKeys = _.without( definedKeys, key );
                    else
                        messages.push( { type: "danger", title: "package.fs missing key", text: ">" + key + "< is required" } );
                });

                optionalKeys.forEach( function( key ) {
                    if( _.contains( definedKeys, key ) )
                        definedKeys = _.without( definedKeys, key );
                });

                /* write warnings for unknown keys */
                definedKeys.forEach( function( key ) {
                    messages.push( { type: "warning", title: "package.fs unknown key", text: ">" + key + "< is not part of the package.fs-standard, please try to avoid unnecessary keys" } );
                });

                /* check if root-directory matches name */
                if( rootDirectory != keyValues["name"] )
                    messages.push( { type: "danger", title: "root directory name invalid", text: "root-directory needs to have the same name as defined in package.fs" });

                /* all done, we have a valid package.fs */

                render();
            });
            inputStream.pipe(parse);
        });

        k.router.get("/upload", function( req, res ) {
            k.jade.render( req, res, "addPackage", vals( req, { title: "Add package", messages: [] } ) );
        });
    }
};

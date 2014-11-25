// theforth.com ajax callbacks
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _ = require('underscore');
var async = require('async');
var jade = require('jade');
var fs = require('fs');
var path = require('path');

module.exports = {
    setup: function( k ) {

        function renderTemplate( req, res, template, data ) {
            //var filename = __dirname + '/views/admin/items/' + template + '.jade';
            console.log( "RENDER".bold.blue, req.path, typeof res.json === "function", template, data );

            async.map( data, function( item, done ) {

                k.renderJade( req, 
                {
                    send: function( html ) {
                        done( null, html );
                    }
                }, "admin/items/"+ template, item );
                
            },
            function( err, results ) {
                if( err )
                    return res.json( { error: err } );

                res.json( {  html: results.join( " " ) } );
            });
        }

        function ajaxError( res, err ) {
            console.log( err );
            res.statusCode = 500;
            res.json( { error: err } );
        };

        function getUserFolder( req ) {
            return path.join( k.kernOpts.websitesRoot, k.modules.hierarchy.website( k.kernOpts.websitesRoot, req.kern.website ), "files", req.session.loggedInUsername );
        };

        k.router.get("/ls", function( req, res ) {
            var folder = getUserFolder( req );

            fs.readdir( folder, function( err, items ) {
                if( err )
                    return ajaxError( res, err );

                async.map( items, function( item, d ) {
                    console.log( folder, item );
                    fs.stat( path.join( folder, item), d );
                },
                function( err, stats )  {
                    if( err )
                        return ajaxError( res, err );

                    var directories = [];
                    var files = [];

                    for( var i = 0; i < stats.length; i++ )
                        if( stats[i].isDirectory() )
                            directories.push( { name: items[i] } );
                        else
                            files.push( { name: items[i] } );
                    res.json( { directories: directories, files: files } );
                });
            });
        });

        k.router.get("/load/:path", function( req, res ) {
            var folder = getUserFolder( req );
            /* TODO: use realpath and compare prefixes */
            var filename = path.join( folder, req.requestData.escapedLink( 'path' ) );
            console.log( "LOAD:", filename );

            fs.readFile( filename, function( err, data ) {
                if( err )
                    return ajaxError( res, err );

                res.json( { content: data.toString() } );
            });
        });
    }
};

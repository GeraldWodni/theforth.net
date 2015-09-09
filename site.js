// theforth.net main include file, needs kern.js, see https://github.com/GeraldWodni/kern.js
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var md5 = require( "md5" );
var _ = require( "underscore" );

module.exports = {
    setup: function( k ) {

        /* add common values for rendering */
        function vals( req, values ) {
            if( !values )
                values = {};

            _.extend( values, {
                loggedIn: "session" in req
            });

            return values;
        }

        k.router.get("/logout", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.jade.render( req, res, "logout" );
            });
        });

        //k.router.use( k.rdb.users.loginRequired( "login" ) );


        var kData = k.getData();

        k.router.use( "/package/:link", function( req, res, next ) {
            k.requestman( req );
            var packageLink = req.requestman.id( "link" );

            kData.packages.readWhere( "name", [ packageLink ], function( err, packages ) {
                if( err ) return next( err );
                if( packages.length == 0 ) return k.httpStatus( req, res, 404 );

                var packet = packages[0];
                kData.users.read( packet.openidUser, function( err, user ) {
                    if( err ) return next( err );

                    user.emailMd5 = md5( user.email );
                    k.jade.render( req, res, "package", vals( req, { packet: packet, user: user } ) );
                });
            });
        });

        k.router.use( "/~:link", function( req, res, next ) {
            k.requestman( req );
            var userLink = req.requestman.id( "link" );

            /* user */
            kData.users.readWhere( "link", [ userLink ], function( err, users ) {
                if( err ) return next( err );
                if( users.length == 0 ) return k.httpStatus( req, res, 404 );

                /* user's packages */
                var user = users[0];
                kData.packages.readWhere( "user", [ user.uin ], function( err, packages ) {
                    if( err ) return next( err );

                    user.emailMd5 = md5( user.email );
                    k.jade.render( req, res, "user", vals( req, { user: user, packages: packages } ) );
                });
            });
        });

        /*
        Maybe thats why German did not succeed as a programming language ;)
        k.verteiler.benutze( "/~:verweis", funktion( anf, ant, nächstes ) {
            k.anfragenMann( anf );
            var benutzerVerweis = anf.anfragenMann.id( "verweis" );
            kDatenbank.benutzer.leseWo( "verweis", [ benutzerVerweis ], funktion( fehler, benutzer ) {
                wenn( fehler )
                    antworte nächstes( fehler );

                wenn( benutzer.länge == 0 )
                    antworte k.httpStatus( anf, ant, 404 );

                ant.json( benutzer );
            });
        });
        */

        k.router.use( "/users", function( req, res, next ) {
            kData.users.readAll( function( err, users ) {
                if( err )
                    return next( err );

                users.forEach( function( user ) {
                    user.emailMd5 = md5( user.email );
                    user.link = k.filters.id( user.name.replace( /\s+/g, "_" ) );
                });

                //users = users.slice( 25, 35 );

                k.jade.render( req, res, "users", vals( req, { users: users }) );
            });
        });

        k.router.use( "/ajax", k.siteModule( "theforth.net", "ajax.js" ).router );

        k.router.get("/euroforth2014", function( req, res ) {
            k.jade.render( req, res, "euroforth2014" );
        });

        k.router.get("/c", function( req, res ) {
            k.jade.render( req, res, "console" );
        });

        k.router.get("/legacy", function( req, res ) {
            var websocketHost = "flink.theforth.net";
            if( k.hostname != "4data" )
                websocketHost = "localhost.theforth.net";
            k.jade.render( req, res, "flink", { websocketHost: websocketHost } );
        });

        k.router.get("/", function( req, res )  {
            k.jade.render( req, res, "home", vals( req ) );
        });
    }
};

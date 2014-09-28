// theforth.net main include file, needs kern.js, see https://github.com/GeraldWodni/kern.js
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

//var websocket = require("nodejs-websocket")

module.exports = {
    setup: function( k ) {
        
        var consoleSockets = [];
        var uplink = null;

        function enableConsoleSocket( consoleSocket ) {
            consoleSocket.state = "open"
            consoleSocket.send("header:Uplink Connected\n" );
            consoleSocket.send( "enable" );
            consoleSocket.send( "start" );
        }

        k.ws("/c", function( ws, req ) {
            ws.state = "waiting";

            console.log( "Console Connected".yellow.bold );
            ws.send( "header:Connected, waiting for Uplink...\n" );

            if( uplink )
                enableConsoleSocket( ws );

            consoleSockets.push( ws );
            ws.on( "message", function( message ) {
                console.log( "Console:", message );

                if( uplink )
                    uplink.send( message );

                consoleSockets.forEach( function( consoleSocket ) {
                    if( consoleSocket.state === "open" && consoleSocket != ws )
                        consoleSocket.send( message );
                });
            });

            ws.on( "error", function( error ) {
                console.log( "Consolesocket error".bold.red, error );
            });

            ws.on( "close", function() {
                console.log( "Consolesocket Closing" );

                var index = consoleSockets.indexOf( ws );
                if( index >= 0 ) {
                    consoleSockets.splice( index, 1 );
                    console.log( "Consolesocket Closed".bold.red );
                }
            });
        });

        k.ws("/uplink", function( ws, req ) {
            console.log( "Uplink Connected".yellow.bold );

            uplink = ws;

            ws.on( "message", function( message ) {
                consoleSockets.forEach( function( consoleSocket ) {
                    if( consoleSocket.state === "waiting" )
                        enableConsoleSocket( consoleSocket );

                    console.log( "Uplink:", message );
                    consoleSocket.send( message );
                });
            });
        });

        k.router.get("/euroforth2014", function( req, res ) {
            k.renderJade( req, res, "euroforth2014" );
        });

        k.router.get("/c", function( req, res ) {
            k.renderJade( req, res, "console" );
        });

        k.router.get("/", function( req, res ) {
            var websocketHost = "flink.theforth.net";
            if( k.hostname != "4data" )
                websocketHost = "localhost.theforth.net";
            k.renderJade( req, res, "flink", { websocketHost: websocketHost } );
        });
    }
};

// theforth.net main include file, needs kern.js, see https://github.com/GeraldWodni/kern.js
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

//var websocket = require("nodejs-websocket")

module.exports = {
    setup: function( k ) {
        
        var consoleSockets = [];
        var uplink = null;

        k.ws("/c", function( ws, req ) {
            ws.state = "waiting";

            console.log( "Console Connected".yellow.bold );
            ws.send( "header:Connected, waiting for Uplink...\n" );

            consoleSockets.push( ws );
            ws.on( "message", function( message ) {
                console.log( "Console:", message );

                if( uplink )
                    uplink.send( message );
            });

            ws.on( "close", function() {
                console.log( "Closing" );

                var index = consoleSockets.indexOf( ws );
                if( index >= 0 )
                    consoleSockets.slice( index, 1 );
            });
        });

        k.ws("/uplink", function( ws, req ) {
            console.log( "Uplink Connected".yellow.bold );

            uplink = ws;

            ws.on( "message", function( message ) {
                consoleSockets.forEach( function( consoleSocket ) {
                    if( consoleSocket.state === "waiting" ) {
                        consoleSocket.state = "open"
                        consoleSocket.send("header:Uplink Connected\n" );
                        consoleSocket.send( "enable" );
                        consoleSocket.send( "start" );
                    }

                    console.log( "Uplink:", message );
                    consoleSocket.send( message );
                });
            });
        });

        k.router.get("/c", function( req, res ) {
            k.renderJade( req, res, "console" );
        });

        k.router.get("/flink", function( req, res ) {
            k.renderJade( req, res, "flink" );
        });
    }
};

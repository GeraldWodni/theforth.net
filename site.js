// theforth.net main include file, needs kern.js, see https://github.com/GeraldWodni/kern.js
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var websocket = require("nodejs-websocket")

module.exports = {
    setup: function( k ) {
        
        var server = websocket.createServer(function (conn) {
            console.log("New connection")
            conn.on("text", function (str) {
                console.log("Received "+str)
                conn.sendText(str.toUpperCase()+"!!!")
            })
            conn.on("close", function (code, reason) {
                console.log("Connection closed")
            })
        }).listen(8001)

        k.router.get("/c", function( req, res ) {
            k.renderJade( req, res, "console" );
        });
    }
};

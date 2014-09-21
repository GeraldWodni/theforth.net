// theforth.net main include file, needs kern.js, see https://github.com/GeraldWodni/kern.js
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = {
    setup: function( k ) {
        k.router.get("/c", function( req, res ) {
            k.renderJade( req, res, "console" );
        });
    }
};

// profile management and user rendering
// (c)copyright 2015-2017 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var md5     = require('md5');
var _       = require('underscore');

var renderUser;

module.exports = {
    setup: function( k ) {

        /* default jade value helper */
        var vals = k.setupOpts.vals;

        var kData = k.getData();
        var db = k.getDb();

        renderUser = function _renderUser( userLink, req, res, next ) {
            /* user */
            kData.users.readWhere( "name", [ userLink ], function( err, users ) {
                if( err ) return next( err );
                if( users.length == 0 ) return httpStatus( req, res, 404 );

                /* user's packages */
                var user = users[0];
                user.emailMd5 = md5( user.email.toLowerCase() );

                kData.packages.readWhere( "user", [ user.id ], function( err, packages ) {
                    if( err ) return next( err );

                    k.jade.render( req, res, "user", vals( req, { user: user, packages: packages, manage: req.session && user.name==req.session.loggedInUsername, title: user.name } ) );
                });
            });
        }

        /* change password */
        k.router.post("/change-password", function( req, res, next ) {
            k.users.changePassword( req, res, function( err ) {
                if( err )
                    k.jade.render( req, res, "changePassword", vals( req, { title: "Change Password", error: err.message } ) );
                else
                    k.jade.render( req, res, "changePassword", vals( req, { title: "Change Password", success: "Password changed" } ) );
            });
        });
        k.router.get("/change-password", function( req, res ) {
            k.jade.render( req, res, "changePassword", vals( req, { title: "Change Password" } ) );
        });

        /* update profile details */
	function renderEditProfile( req, res, next, values ) {
            db.query("SELECT details FROM users WHERE name=?", [req.session.loggedInUsername ], function( err, data ) {
                if( err ) return next( err );
                if( data.length != 1 ) return k.httpStatus( req, res, 404 );

                k.jade.render( req, res, "editProfile", vals( req, _.extend( { title: "Edit profile", user: data[0] }, values ) ) );
            });
	}
        k.router.post("/edit", function( req, res, next ) {
            k.postman( req, res, function() {
                db.query("UPDATE users SET details=? WHERE name=?", [
                    req.postman.text("details"),
                    req.session.loggedInUsername
                ], function( err ) {
                    if( err ) return next( err );
                    renderEditProfile( req, res, next, { messages: [ { type: "success", title: "Success", text: "Profile updated"} ] } );
                });
            });
        });

        k.router.get("/edit", function( req, res, next ) {
	    renderEditProfile( req, res, next );
        });

        /* render logged in user */
        k.router.get("/", function( req, res, next ) {
            renderUser( req.session.loggedInUsername, req, res, next );
        });

    },
    renderUser: function() { renderUser.apply( this, arguments ); }
};

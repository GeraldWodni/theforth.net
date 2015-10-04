// minmalistic forth parser for package.fs
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

module.exports = function _forthParser( content, words ) {
    var remaining = content;

    function keyQuery() {
        return remaining.length > 0;
    }

    function keyPeek() {
        return remaining.substr(0,1);
    }

    function key() {
        if( !keyQuery() )
            return null;

        var next = keyPeek();
        remaining = remaining.substr(1);
        return next;
    }

    function skip( delimiter ) {
        while( keyQuery() && keyPeek() == delimiter )
            key();
    }

    function parse( delimiter ) {
        var token = "";
        while( true ) {
            var c = key();
            if( c == delimiter || c == null || c == "\n" || c == "\r" )
                return token;
            token += c;
        }
    }

    function parseName() {
        var word = "";

        while( word == "" ) {
            skip(" ");
            word = parse(" ");
            if( word === null )
                return null;
        }

        return word;
    }

    var context = {
        parse: parse,
        parseName: parseName
    }

    while( keyQuery() ) {
        var word = parseName();

        if( word in words )
            words[ word ].apply( context );
        else if( " " in words )
            words[ " " ].apply( context, [word] );
    }
};

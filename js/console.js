$(document).ready(function() {

    /* setup editor */
    var languageTools = ace.require( "ace/ext/language_tools" );
    var editor = ace.edit("editor");
    editor.setOptions( { enableBasicAutocompletion: true } );

    /* (200x-) auto completion */
    var words =  [ "field", "field+", "field-float", "field-offset" ];
    var forth200xCompleter = {
        getCompletions: function( editor, session, pos, prefix, callback ) {
            callback( null, words.map( function( word ) {
                return { name: word, value: word, score: 100, meta: "200x" };
            }) );
        }
    };

    languageTools.addCompleter( forth200xCompleter );

    /* websocket */
    var websocket = new WebSocket( "ws://localhost.theforth.net:8001/" );
    console.log( "WS:", websocket );
    websocket.onopen =  function( evt ) { console.log( "open", evt ); websocket.send( "Hallo" ); };
    websocket.onclose= function( evt ) { console.log( "close", evt ); };
    websocket.onerror= function( evt ) { console.log( "error", evt ); };
    console.log( editor );
    websocket.onmessage= function( evt ) { console.log( "message", evt ); 
        //editor.insert( editor.getSession().getSelection(), "xxx" );
        editor.getSession().insert( editor.getSession().getSelection().getCursor()
        , "\\ " + evt.data + "\n" );
    };

    /* console behaviour */
    editor.on("change", function(e) {
        /* newline! */
        if( e.data.action === "insertText" ) {
            var text = e.data.text;
            if( text === "\n" || text === "\r" || text === "\r\n" ) {
                var lineNumber =  e.data.range.start.row;
                var lineContent = editor.getSession().getDocument().getLine( lineNumber );
                if( lineContent.indexOf( "\\" ) === 0 )
                    return;
                console.log( "LINE:", lineContent );
                websocket.send( lineContent );
            }
        }
    });
});

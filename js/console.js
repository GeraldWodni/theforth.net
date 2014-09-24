$(document).ready(function() {

    /* configuration */
    var websocketUrl = "ws://flink.theforth.net:8000/c";

    /* setup console */
    var jqconsole = $('#console').jqconsole("", '> ');
    jqconsole.Write( "Connecting to theforth.net...\n", "header" );
    jqconsole.Disable();

    /* websocket */
    var websocket = new ReconnectingWebSocket( websocketUrl );

    websocket.onopen =  function( evt ) {
    };
    websocket.onclose= function( evt ) {
        jqconsole.Write( "Disconnected from theforth.net\n", "header" );
        jqconsole.Disable();
    };

    websocket.onerror= function( evt ) {
        jqconsole.Write( "Error: " + evt, "header" );
    };

    var startPrompt = function() {
        jqconsole.Prompt( true, function( input ) {
            websocket.send( "input:" + input + "\n" );
            startPrompt();
        });
    }

    websocket.onmessage= function( evt ) {
        var border = evt.data.indexOf( ":" );
        var command;
        var data;
        
        if( border === -1 ) {
            command = evt.data;
            data = "";
        }
        else {
            command = evt.data.substring( 0, border );
            data = evt.data.substring( border + 1 );
        }

        if( command === "header" || command === "output" || command === "error" )
            jqconsole.Write( data, command );
        else if( command === "enable" )
            jqconsole.Enable();
        else if( command === "disable" )
            jqconsole.Disable();
        else if( command === "start" )
            startPrompt();
        else
            jqconsole.Write( "Unknown Server-Command:" + command + "//" + data + "\n", "header");
            
    };

    ///* setup editor */
    //var languageTools = ace.require( "ace/ext/language_tools" );
    //var editor = ace.edit("editor");
    //editor.setOptions( { enableBasicAutocompletion: true } );

    ///* (200x-) auto completion */
    //var words =  [ "field", "field+", "field-float", "field-offset" ];
    //var forth200xCompleter = {
    //    getCompletions: function( editor, session, pos, prefix, callback ) {
    //        callback( null, words.map( function( word ) {
    //            return { name: word, value: word, score: 100, meta: "200x" };
    //        }) );
    //    }
    //};

    //languageTools.addCompleter( forth200xCompleter );

    ///* websocket */
    //var websocket = new WebSocket( "ws://localhost.theforth.net:3000/c" );
    //console.log( "WS:", websocket );
    //websocket.onopen =  function( evt ) { console.log( "open", evt ); websocket.send( "Hallo" ); };
    //websocket.onclose= function( evt ) { console.log( "close", evt ); };
    //websocket.onerror= function( evt ) { console.log( "error", evt ); };
    //console.log( editor );
    //websocket.onmessage= function( evt ) { console.log( "message", evt ); 
    //    //editor.insert( editor.getSession().getSelection(), "xxx" );
    //    editor.getSession().insert( editor.getSession().getSelection().getCursor()
    //    , "\\ " + evt.data + "\n" );
    //};

    ///* console behaviour */
    //editor.on("change", function(e) {
    //    /* newline! */
    //    if( e.data.action === "insertText" ) {
    //        var text = e.data.text;
    //        if( text === "\n" || text === "\r" || text === "\r\n" ) {
    //            var lineNumber =  e.data.range.start.row;
    //            var lineContent = editor.getSession().getDocument().getLine( lineNumber );
    //            if( lineContent.indexOf( "\\" ) === 0 )
    //                return;
    //            console.log( "LINE:", lineContent );
    //            websocket.send( lineContent + "\n" );
    //        }
    //    }
    //});
});

$(function(){ 
    /* setup editor */
    var languageTools = ace.require( "ace/ext/language_tools" );
    var editor = ace.edit("editor");
    editor.setOptions( { enableBasicAutocompletion: true } );

    var screenMinSm = 768;

    function viewport() {
        var e = window, a = 'inner';
        if (!('innerWidth' in window )) {
            a = 'client';
            e = document.documentElement || document.body;
        }
        return { width : e[ a+'Width' ] , height : e[ a+'Height' ] };
    }

    function resize($element) {
        var width = $element.outerWidth();
        var parentWidth  = $element.parent().width();
        var parentHeight = $element.parents(".main-content").height();
        var remainingWidth = parentWidth - width - 1;

        /* check  */
        var windowViewport = viewport();
        var smallHeight = ( windowViewport.height - 100 ) + "px";
        if( windowViewport.width < screenMinSm ) {
            $element.css("height", smallHeight);
            $.each( $element.siblings(), function( index, sibling ) {
                $(sibling).css( {
                    width: "",
                    height: smallHeight
                });
            });
        }
        else {
            $element.css("height", parentHeight + "px" );

            $.each( $element.siblings(), function( index, sibling ) {
                $(sibling).css( {
                    width: remainingWidth + "px",
                    height: parentHeight + "px"
                });
            });
        }

        editor.resize();
    };

    $('#editorPane').resizable({
        handles: 'e',
        minWidth: 150,
        maxWidth: 1200,
        resize: function(event, ui) {
            resize( ui.element );
        }
    });

    /* window resizing */
    var resizeTime = new Date( 1, 1, 2000, 0, 0, 0 );
    var resizeTimeout = false;
    var resizeTimeDelta = 200;

    function resizeCallback() {
        if( new Date() - resizeTime < resizeTimeDelta )
            setTimeout( resizeCallback, resizeTimeDelta );
        else {
            resizeTimeout = false;
            resize( $("#editorPane" ) );
        }
    }

    $(window).resize(function() {
        resizeTime = new Date();
        if( resizeTimeout === false ) {
            resizeTimeout = true;
            setTimeout( resizeCallback, resizeTimeDelta );
        }
    });
    
    /* trigger initial resize */
    setTimeout( function() {
        resize( $('#editorPane' ) );
    }, 200);


    $("#menu-run").click( function(e) {
        e.preventDefault();
        var editSession = editor.getSession();

        if( editSession.getLength() == 0 )
            return;

        var lineNumber = 0;

        function sendNextLine( err ) {
            if( err )
                return;

            if( lineNumber < editSession.getLength() ) {
                flinkConsole.send( editSession.getLine( lineNumber ), sendNextLine );
            }

            lineNumber++;
        }

        sendNextLine( null );
    });

    $("#menu-load").click( function(e) {
        e.preventDefault();

        $.get( "/ajax/ls", function( data ) {
            console.log( data );
            var $ul = $("#modal-load ul");
            $ul.empty();

            data.directories.forEach( function( item ) {
                $ul.append( '<li><i class="glyphicon glyphicon-folder-close"/> ' + item.name + "</li>" );
            });

            data.files.forEach( function( item ) {
                $ul.append('<li><i class="glyphicon glyphicon-file"/> <span class="filename">' + item.name + "</span></li>" );
            });

            $ul.find("li").click( function() {
                $.get( "/ajax/load/" + $(this).find(".filename").text(), function( data ) {
                    editor.getSession().getDocument().setValue( data.content );
                    $("#modal-load").modal("hide");
                });
            });
        });

        $("#modal-load").modal("show");
    });

    $("#menu-info").click( function(e) {
        e.preventDefault();
        $("#modal-info").modal("show");
    });
});

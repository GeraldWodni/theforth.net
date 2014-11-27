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
            var code = "";
            $ul.empty();

            function listify( items ) {
                items.forEach( function( item ) {
                    code += '<li class="' + ( item.isDirectory ? "directory" : "file" ) + '" ';
                    code += 'data-path="' + item.path + '" >';
                    code += '<i class="glyphicon glyphicon-' + ( item.isDirectory ? "folder-close" : "file" ) + '"/> ';
                    code += item.name;

                    if( item.isDirectory ) {
                        code += '<ul style="display:none">';
                        listify( item.children );
                        code += '</ul>';
                    }

                    code += '</li>\n';
                });
            }

            listify( data ); 

            console.log( code );

            $ul.html( code );

            $ul.find("li").click( function() {
                var $this = $(this);
                if( $this.hasClass( "directory" ) ) {
                    var $icon = $this.find("i.glyphicon").first();

                    $icon.toggleClass( "glyphicon-folder-open" ).toggleClass( "glyphicon-folder-close" );
                    $this.find("ul").toggle();
                }
                else {
                    $.get( "/ajax/load/" + encodeURIComponent( $(this).attr("data-path") ), function( data ) {
                        editor.getSession().getDocument().setValue( data.content );
                        $("#modal-load").modal("hide");
                    });
                }
            });
        });

        $("#modal-load").modal("show");
    });

    $("#menu-gui").click(function(e) {
        e.preventDefault();

        $("#modal-gui").find("[data-command]").unbind().click( function() {
            flinkConsole.send( $(this).attr("data-command" ) );
        });

        $("#modal-gui").modal("show");
    });

    $("#menu-info").click( function(e) {
        e.preventDefault();
        $("#modal-info").modal("show");
    });
});

$(function(){ 
    /* setup editor */
    var languageTools = ace.require( "ace/ext/language_tools" );
    var editor = ace.edit("editor");
    editor.setOptions( { enableBasicAutocompletion: true } );

    function resize($element) {
        var width = $element.outerWidth();
        var parentWidth  = $element.parent().width();
        var parentHeight = $element.parents(".main-content").height();
        var remainingWidth = parentWidth - width - 1;

        $element.css("height", parentHeight + "px" );

        $.each( $element.siblings(), function( index, sibling ) {
            $(sibling).css( {
                width: remainingWidth + "px",
                height: parentHeight + "px"
            });
        });

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
});

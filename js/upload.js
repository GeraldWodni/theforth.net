$(function(){
    /* hide guidelines if user messages are shown ( and provide a toggle icon ) */
    if( $(".main-content .alert").length == 0 )
        return;

    var $handle = $("#package-guidelines-header");
    var $packageGuidelines = $("#package-guidelines");

    $handle.prepend('<i class="fa fa-plus-square" style="cursor:pointer" title="toggle view guidlines"/> ');
    $handle.click(function() {
        $handle.find("i").toggleClass("fa-plus-square fa-plus-square-o");
        $packageGuidelines.toggle();
    });

    $packageGuidelines.hide();
});

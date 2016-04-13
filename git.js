// Git interface for pushing packages to github
// (c)copyright 2016 by Gerald Wodni <gerald.wodni@gmail.com>

var path      = require("path");
var Git       = require("nodegit");

/* package subrepo status */
function repoStatus( dir, callback ) {
    Git.Repository.open(dir)
        .then(function(repo){
            repo.getStatus().then(function(stati){
                callback( null, stati, repo );
            });
        }).
        catch(function(err){
            callback( err );
        });
}

/* from: https://github.com/nodegit/nodegit/blob/master/examples/status.js */
function statusToText(status) {
    var words = [];
    if (status.isNew()          ) { words.push("NEW"); }
    if (status.isModified()     ) { words.push("MODIFIED"); }
    if (status.isTypechange()   ) { words.push("TYPECHANGE"); }
    if (status.isRenamed()      ) { words.push("RENAMED"); }
    if (status.isIgnored()      ) { words.push("IGNORED"); }

    return words.join(" ");
}

function getStatus( dir, callback ) {
    repoStatus( dir, function( err, stati ) {
        if( err ) return callback( err )

        var files = [];
        stati.forEach(function(file){
            files.push( { path: file.path(), status: statusToText( file ) } );
        });

        callback( null, files );
    });
}

function addCommitPush( sshDir, dir, commitMessage, callback ) {
    repoStatus( dir, function( err, stati, repo ) {
        if( err ) return callback( err )

        var index, oid, remote;

        /* add files */
        repo.index().then(function(i){
            index = i;
            stati.forEach(function(file){
                console.log( "Adding".bold.green, file.path() );
                index.addByPath( file.path() );
            });
            return index.writeTree();
        })
        /* commit */
        .then(function(o){
            oid = o;
            return Git.Reference.nameToId( repo, "HEAD" );
        })
        .then(function(head){
            return repo.getCommit(head);
        })
        .then(function(parent){
            var sig = repo.defaultSignature();
            return repo.createCommit( "HEAD", sig, sig, commitMessage, oid, [ parent ] );
        })
        /* push to remote */
        .then(function(){
            return repo.getRemote("origin");
        }) .then(function(r){
            remote = r;
            remote.setCallbacks( {
                credentials: function( url, userName ) {
                    console.log( "credentials: ", url, userName );
                    return Git.Cred.sshKeyNew( 'git', path.join( sshDir, 'id_rsa.pub' ), path.join( sshDir, 'id_rsa' ), '' );
                }
            });
            return remote.connect( Git.Enums.DIRECTION.PUSH );
        }).then(function( number ) {
            return remote.push(
                ["refs/heads/master:refs/heads/master"],
                null,
                repo.defaultSignature(),
                "Push to master test"
            );
        })
        .catch(function(err){ callback( err ) })
        .done(function(s){
            callback( null, s );
        });
    });
    
}

module.exports = {
    getStatus: getStatus,
    addCommitPush: addCommitPush
};

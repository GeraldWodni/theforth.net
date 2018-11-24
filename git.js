// Git interface for pushing packages to github
// (c)copyright 2016, 2018 by Gerald Wodni <gerald.wodni@gmail.com>

const path      = require("path");
const simpleGit = require("simple-git");

/* package subrepo status */
function repoStatus( dir, callback ) {
    const git = simpleGit( dir );
    git.status( callback );
}

function getStatus( dir, callback ) {
    repoStatus( dir, ( err, stati ) => {
        if( err ) return callback( err );

        var files = [];
        function addStatiFiles( statiFiles, text ) {
            statiFiles.forEach( file => files.push({
                path: file,
                status: text
            }) );
        }

        addStatiFiles( stati.not_added,     "NOT ADDED" );
        addStatiFiles( stati.conflicted,    "CONFLICT"  );
        addStatiFiles( stati.created,       "CREATED"   );
        addStatiFiles( stati.deleted,       "DELETED"   );
        addStatiFiles( stati.modified,      "MODIFIED"  );
        addStatiFiles( stati.renamed,       "RENAMED"   );
        addStatiFiles( stati.staged,        "STAGED"    );

        callback( null, files );
    });
}

function addCommitPush( sshDir, dir, commitMessage, callback ) {

    const GIT_SSH_COMMAND = `ssh -i ${sshDir}.id_rsa`;
    const git = simpleGit( dir );
        git.env("GIT_SSH_COMMAND", GIT_SSH_COMMAND)
        .add("./*")
        .commit( commitMessage )
        .push( 'origin', 'master', callback );
}

module.exports = {
    getStatus: getStatus,
    addCommitPush: addCommitPush
};

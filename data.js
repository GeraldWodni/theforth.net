module.exports = {
    setup: function _setup( k ) {
        var db = k.getDb();

        var users =  k.crud.sql( db, { table: "users",     key: "id", foreignName: "name",
            wheres: {
                "name": { where: "`name`=?" }
            }
        } );

        var legacyUsers =  k.crud.sql( db, { table: "openidUsers",     key: "uin", foreignName: "name",
            wheres: {
                "link": { where: "`link`=?" }
            }
        } );

        var tags =  k.crud.sql( db, { table: "tagNames",     key: "id", foreignName: "name",
            wheres: {
                "name": { where: "`name`=?" }
            }
        } );

        var packages =  k.crud.sql( db, { table: "packages",     key: "id", foreignName: "name",
            wheres: {
                "name": { where: "`name`=?" },
                "user": { where: "`user`=?" }
            }
        } );

        return {
            legacyUsers:    legacyUsers,
            packages:       packages,
            tags:           tags,
            users:          users
        };
    }
}

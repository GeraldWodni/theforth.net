module.exports = {
    setup: function _setup( k ) {
        var db = k.getDb();

        var users =  k.crud.sql( db, { table: "openidUsers",     key: "uin", foreignName: "name",
            wheres: {
                "link": { where: "`link`=?" }
            }
        } );

        var packages =  k.crud.sql( db, { table: "projects",     key: "uin", foreignName: "name",
            wheres: {
                "name": { where: "`name`=?" },
                "user": { where: "`openIdUser`=?" }
            }
        } );

        return {
            users:          users,
            packages:       packages
        };
    }
}

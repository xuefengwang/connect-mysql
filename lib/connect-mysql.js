var debug = require('debug')('connect:mysql');
var mysql = require('mysql');

/**
 * CREATE TABLE `sessions` (
 *  `sid` varchar(255) NOT NULL,
 *  `session` varchar(2048) NOT NULL DEFAULT '',
 *  `updated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 *  PRIMARY KEY (`sid`)
 * ) ENGINE=InnoDB DEFAULT CHARSET=utf8;
 * @param session
 * @returns {MySQLStore}
 */
module.exports = function (session) {

    // express's session store
    var Store = session.Store;
    var tableName = 'sessions';

    function MySQLStore(options) {
        if (!(this instanceof MySQLStore)) {
            throw new TypeError('Cannot call MySQLStore constructor as a function');
        }

        var self = this;

        options = options || {};
        Store.call(this, options);

        if (options.url) {
            debug('connect to database via url', options.url);
            var db = mysql.createConnection(options.url);
            db.connect(function (err) {
                if (err) {
                    debug('cannot connect to ' + options.url, err);
                    self.emit('error', err);
                } else {
                    self.emit('connected');
                    self.db = db;

                    if (options.table) {
                        tableName = db.escapeId(options.table);
                    }
                    db.query('DESC ' + tableName, function (err, result) {
                        if (err) {
                            debug('cannot find session table: ' + tableName);
                            self.emit('error', err);
                        }
                    });
                }
            });
        }
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.get = function (sid, cb) {
        debug('get store', sid);
        this.db.query('SELECT session FROM ' + tableName + ' WHERE sid = ?', [sid], function (err, rows) {
            if (err) return cb(err);

            if (rows.length > 0) {
                cb(null, JSON.parse(rows[0].session));
            } else {
                cb(null, null);
            }
        });
    };

    MySQLStore.prototype.set = function (sid, sess, cb) {
        debug('set store', sid);
        try {
            var jsess = JSON.stringify(sess);
        } catch (e) {
            return cb(e);
        }
        try {
            this.db.query('INSERT INTO ' + tableName + ' (sid, session) VALUES(?, ?) ON DUPLICATE KEY UPDATE session = ?', [sid, jsess, jsess],
                function (err, result) {
                    cb(err);
                }
            );
        } catch (e) {
            return cb(e);
        }
    };

    MySQLStore.prototype.destroy = function (sid, cb) {
        debug('destroy store', sid);
        this.db.query('DELETE FROM ' + tableName + ' WHERE sid = ?', [sid], function (err) {
            cb(err);
        });
    };

    MySQLStore.prototype.clear = function (cb) {
        debug('clear store');
        this.db.query('TRUNCATE TABLE ' + tableName, function (err) {
            cb(err);
        });
    };

    return MySQLStore;
};


var Database = new Class({
    initialize: function(properties) {
        this.db_name = properties.name;
        this.tables = properties.tables.filter( function(x) { return x.length == 2 } );
        this.version = properties.version;
        this.failure_handler = properties.error_handler || function(x) {};
        this.estimated_size = properties.size || 120480;
        this.setup();
    },
    
    setup: function() {
        if(this.db_handle) {return null;}
        try { 
            this.db_handle = window.openDatabase(this.db_name, this.version, this.db_name, this.estimated_size);
        }
        catch(e) {
            if(this.failure_handler) { this.failure_handler(e) }
        }
        this.validate_tables();
    },
    
    
    callSql: function(sql, obj_args, callback) {
        this.db_handle.transaction( 
            function(tx) {
                tx.executeSql(sql, obj_args,
                    function(tx, r) {callback(r)},
                    function(tx, error) {this.failure_handler(error)})
            }
        )
        return this;
    },
    
    // Internal methods.
    // We don't swim in your toilet, so please don't pee in our pool.
    insert_schema: function() {
        if(!this.db_handle) {
            throw {name: 'Redundant Initialization Error', message: "I told you not to pee in my pool. Premature insert_sechema"};
        }
        var self = this;
        this.tables.each(
          function(tuple) {
            var name = tuple[0]; var tablespec = tuple[1];
            self.db_handle.transaction( 
                function(tx) {
                    tx.executeSql("DROP TABLE "+name, [], function(tx, x) {},
                                                          function(tx, er) {}),
                    tx.executeSql("CREATE TABLE "+name+" (" + tablespec + ")", [],
                                  function(tx, x) {},
                                  function(tx, er) {})
                })
          })  
    },
    
    setup_helpers: function() {
        if(!this.db_handle) {
            throw {name: 'Premature Initialization Error', message: "I told you not to pee in my pool. Premature insert_sechema"};
        }
        var self = this;
        this.tables.each(
            function(tuple) { 
                var name = tuple[0];
                var tableFields = tuple[1].split(",")
                var tableFieldNames = tableFields.map( function(str) {return str.match(/[^, ]+/)[0]} );
                var numFields = tableFields.length;
                var valuesString = "(?"
                for(var ctr = 1 ; ctr < numFields ; ctr += 1) {
                    valuesString += ",?"
                }
                valuesString += ")";
                var fieldString = "(" + tableFieldNames.join(",") + ")";
                
                var queryGenerator = function(verb,tblName,conditions) {
                    if(conditions) {
                        return verb + " FROM " + tblName + " WHERE " + conditions;
                    }
                    else {
                        return verb + " FROM " + tblName;
                    }
                };
                var helper_funobj = function() {
                    if(arguments.length < 1) {
                        // We can do nothing
                    }
                    else if(arguments.length == 1) {
                        // Just a callback
                        self.callSql(queryGenerator("SELECT *", name), [], arguments[0]);
                    }
                    else if(arguments.length == 2) {
                        // Simple args and a callback
                        self.callSql(queryGenerator("SELECT *", name, arguments[0]), [], arguments[1]);
                    }
                    else {
                        self.callSql(queryGenerator("SELECT *", name, arguments[0]), arguments[1], arguments[2]);
                    }
                }
                helper_funobj.remove = function(conditions,objects) { 
                    self.callSql(queryGenerator("DELETE", name, conditions), (objects || []), function() {});
                }
                helper_funobj.insert = function() {
                    if(arguments.length != numFields) {
                        throw {name:'Undefined Field Error', message: "You need to provide at least " + numFields + "fields to #insert."}
                    }
                    else {
                        self.callSql("INSERT INTO " +name+ " " + fieldString + " VALUES " + valuesString, arguments, function() {})
                    }
                }
                self[name + "z"] = helper_funobj
            }, this)
    },
    
    validate_tables: function() {
        // Sometimes you can have as much fun indoors as outdoors.
        var self = this;
        var found = 0; var needed = this.tables.length; var reported = 0;
        var callback = function(present) {
          if(present) {
            found += 1;
          }
          reported += 1;
          if(reported == needed) {
            if(found < needed) {
              self.insert_schema();
            }
            self.setup_helpers();
            self.initalized = true
          }
        }
          
        this.tables.each( function(x) { 
            self.db_handle.transaction( function(tx) {
                tx.executeSql( "SELECT COUNT(*) FROM " + x[0], [], 
                    function(tx, r) {callback(true)},
                    function(tx, error) {callback(false)})
            })
        });
    }
});



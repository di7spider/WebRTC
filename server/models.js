var 
	config = require(dirs.root + '/config'),
	Sequelize = require("sequelize"),
	sequelize = new Sequelize(config.db.name, config.db.login, config.db.pass, {
	  host: config.db.host,
	  dialect: config.db.dialect,
	 // port : config.db.port,
	  pool: {
	    max: 5,
	    min: 0,
	    idle: 10000
	  }
	}),
	models = {
		user : sequelize.define(
			'user', {
			  id: {
			    type: Sequelize.INTEGER,
		        primaryKey: true,
		        autoIncrement: true
			  },
			  password: {
			  	type: Sequelize.STRING
			  },
			  email: {
			  	type: Sequelize.STRING
			  },
			  name: {
			    type: Sequelize.STRING
			  },
			  company: {
			    type: Sequelize.STRING
			  },
			  position: {
			    type: Sequelize.STRING
			  },
			  admin: {
			    type: Sequelize.BOOLEAN,
			    defaultValue : false
			  },
			  avatar: {
			  	type: Sequelize.STRING
			  }
			}, {
			  freezeTableName: true
			}
		),
		sid : sequelize.define(
			'sid',{
				id: {
				    type: Sequelize.INTEGER,
			        primaryKey: true,
			        autoIncrement: true
				},
				sid: {
					type: Sequelize.STRING
				},
				uid: {
					type: Sequelize.INTEGER
				},
				'status' : {
					type: Sequelize.INTEGER,
					defaultValue : 0
				}
			}, {
			  freezeTableName: true 
			}				
		)
	};

// models.user.sync({force: true}).then(function(){

//   models.user.create();
// });

// models.sid.sync({force: true}).then(function(){

//   models.sid.create();
// });

module.exports = models;
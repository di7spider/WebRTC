var
	config = require(dirs.root + '/config'),
	_ = require('lodash'),
	models = require(__dirname + '/models'),
	utils = require(__dirname + '/utils'),
	fs = require('fs'),
	methods = {

		/** Удалить временное изображение */
		removeTempFile : function(data, callback){
			
			var file = dirs.uploads + '/temp/' + data.file;

			fs.stat(file, function(err, is){

				if(!err){
					
					fs.unlink(file, function(is){

						callback({remove : true});
					});
				
				}else{

					callback({errors : 'Файл не найден'});
				}
			});
		},

		/** Возвращает новую комнату */
		nowRoom : function(data, callback){

			while(true){
				
				var room = utils.genStr();

				if( !_.has(data.io.sockets.adapter.rooms, room) ){

					callback(room);
					break;
				}
			}
		},

		/** Отмена приглашения на вступление в комнату */
		rejectToRoom : function(data, callback){

			var id = data.storage.conn[data.hsid];

			id && data.io.sockets.connected[id].emit(
	        	'api:rejectToRoom', {
	              	id : data.st.id,
	              	hsid : data.st.hsid,
	              	data : {
	              		userName : data.userName
	              	}
	            }
	    	);

	    	callback({});
		},	

		/** Пригласить пользователя в комнату */
		userToRoom : function(data, callback){

			var id = data.storage.conn[data.hsid];

			if(id){

				data.io.sockets.connected[id].emit(
                	'api:userToRoom', {
	                  	id : data.st.id,
	                  	hsid : data.st.hsid,
	                  	data : {
	                  		room : data.room,
	                  		userName : data.userName
	                  	}
	                }
            	);

            	callback({});
			
			}else{

				callback({error : 'Сотрудника в данный момент нет на месте'});
			}
		},

		/** Получает список сотрудников */
		employeesList : function(data, callback){

			var done = function(list){

				if(list.length){
					
					var result = {};

					_.each(list, function(item){ 
							
						item = item.get();

						item.status = item.status || 0;

						result[item.id] = item;
					});

					models.sid.findAll({
						where : {
							uid : _.keys(result)
						},
						attributes : [
							"uid",
							"sid",
							"status"
						]
					}).then(function(list1){

						_.each(list1, function(item){

							result[item.uid].hsid = utils.genHash(
								item.get('sid')
							);
							
							result[item.uid].status = item.get('status');
						});

						callback(result);
					});
				
				}else{

					callback(list);
				}
			};

			models.user.findAll({
				order : [
					["name", "ASC"]
				],
				where : {
					admin : true
				},
				attributes : [
					"id",
					"name",
					"avatar",
					"position"
				]
			}).then(done);
		},

		/** User Login */
		userLogin : function(data, callback){
			
			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(prms){

					prms = prms || {};

					/** Обновляем данные по пользователю в комнате */
					if(data.io && data.st && data.st.room){ 

						var 
							users = data.storage.users[data.st.room] = data.storage.users[data.st.room] || {},
                         	user = users[data.st.hsid] || {};

                        users[data.st.hsid] = _.extend(user, {
                        	nameOld : prms.name != user.name ? user.name : '',
                        	name : prms.name
                        });

		                data.io.sockets.in(data.st.room).emit(
		                    'room', {
		                      	id : data.st.id,
		                      	hsid : data.st.hsid,
		                      	type : "user.refresh",
		                      	data : {
		                      		user : users[data.st.hsid]
								}
		                    }
		                );
		            }

					callback({
						id : prms.id,
						name : prms.name,
						avatar : prms.avatar
					});
				},
				reject = function(prms){

					callback({errors : prms})
				},
				select = ['id', 'name', 'avatar', 'password'];

			if(sid){

				utils.getSid({sid: sid}).then(function(infoSid){

					if( !_.isEmpty(infoSid) ){

						utils.getUser({id : infoSid.uid}, select).then(resolve, reject);

					}else{

						var valid = utils.valid(data);

						if( _.isEmpty(valid.errors) ){

							valid = valid.valid;

							utils.getUser({email: valid.email}, select).then(function(user){

								if( _.isEmpty(user) ){

									reject({email: 'E-mail не зарегистрирован'});
								
								}else{

									if( user.password !== utils.genHash(valid.pass) ){

										reject({email: 'Не верный E-mail/Пароль'});
									
									}else{

										models.sid.create({
										    sid: sid,
										    uid: user.id
										}).then(function(){ 
											
											resolve({
												id : user.id,
												name : user.name,
												admin : user.admin,
												avatar : user.avatar
											}); 

										}, reject);
									}
								}

							}, reject);

						}else{

							reject(valid.errors);
						}
					}
				});

			}else{

				reject({sid : 'Error SID'});
			}
		},

		/** Admin Register */
		adminReg : function(data, callback){

			var 
				resolve = function(prms){

					prms = prms || {};

					callback(prms || {});
				},
				reject = function(data){

					callback({errors : data})
				},
				select = ['id', 'name'],
				auth = (data['auth_basic_admin'] || "").split("||");

			if(config.basic && auth[0] == config.basic.login && auth[1] == config.basic.pass){

				var valid = utils.valid(data);

				if( _.isEmpty(valid.errors) ){

					valid = valid.valid;

					utils.getUser({email: valid.email}, select).then(function(user){

						if( _.isEmpty(user) ){

							if(valid.avatar){

								var 
									oldPath = dirs.uploads + '/temp/' + valid.avatar,
									name = 'avatar_' + Date.now() + '_'  + oldPath.match(/\..*$/)[0];
									newPath = dirs.uploads + '/' + name;

								try{
								 	
								 	fs.statSync(oldPath)

									fs.renameSync(oldPath, newPath);

									valid.avatar = name;

								}catch(e){

									delete valid.avatar;
								}
							}

	 						models.user.create({
							    password: utils.genHash(valid.pass),
							    email: valid.email,
							    name: valid.name,
							    company: valid.company,
							    position: valid.position,
							    avatar: valid.avatar,
							    admin : true
							}).then(function(user){

								resolve({
									id : user.id,
									name : user.name,
									admin : user.admin,
									avatar : user.avatar
								});
							});
						
						}else{

							reject({email: 'Этот E-mail уже зарегистрирован'});
						}

					}, reject);

				}else{

					reject(valid.errors);
				}

			}else{

				reject({auth : 'BASIC_AUTH_ERROR'});
			}
		},

		/** User Register */
		userReg : function(data, callback){

			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(prms){

					prms = prms || {};

					/** Обновляем данные по пользователю в комнате */
					if(data.io && data.st && data.st.room){ 

						var 
							users = data.storage.users[data.st.room] = data.storage.users[data.st.room] || {},
                         	user = users[data.st.hsid] || {};

                        users[data.st.hsid] = _.extend(user, {
                        	nameOld : prms.name != user.name ? user.name : '',
                        	name : prms.name
                        });

		                data.io.sockets.in(data.st.room).emit(
		                    'room', {
		                      	id : data.st.id,
		                      	hsid : data.st.hsid,
		                      	type : "user.refresh",
		                      	data : {
		                      		user : users[data.st.hsid]
								}
		                    }
		                );
		            }

					callback(prms || {});
				},
				reject = function(data){

					callback({errors : data})
				},
				select = ['id', 'name'];

			if(sid){

				utils.getSid({sid: sid}).then(function(infoSid){

					if( !_.isEmpty(infoSid) ){

						utils.getUser({id : infoSid.uid}, select).then(resolve, reject);

					}else{

						var valid = utils.valid(data);

						if( _.isEmpty(valid.errors) ){

							valid = valid.valid;

							utils.getUser({email: valid.email}, select).then(function(user){

								if( _.isEmpty(user) ){
									
			 						models.user.create({
									    password: utils.genHash(valid.pass),
									    email: valid.email,
									    name: valid.name
									}).then(function(user){

										models.sid.create({
										    sid: sid,
										    uid: user.id
										}).then(function(){ 
											
											resolve({
												id : user.id,
												name : user.name,
												admin : user.admin
											}); 

										}, reject);
									});
								
								}else{

									reject({email: 'Этот E-mail уже зарегистрирован'});
								}

							}, reject);

						}else{

							reject(valid.errors);
						}
					}

				}, reject);

			}else{

				reject({sid : 'Error SID'});
			}
		}, 

		/** User Logout */
		userLogout : function(data, callback){

			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(prms){

					/** Обновляем данные по пользователю в комнате */
					if(data.io && data.st && data.st.room){ 

						var 
							users = data.storage.users[data.st.room] = data.storage.users[data.st.room] || {},
                         	user = users[data.st.hsid] || {},
                         	name = "Участник " + (_.keys(users).indexOf(data.st.hsid) + 1);

                        users[data.st.hsid] = _.extend(
                        	users[data.st.hsid] || {}, {
                        		nameOld : user.name != name ? user.name : "",
                        		name : name
                        	}
                        );

		                data.io.sockets.in(data.st.room).emit(
		                    'room', {
		                      	id : data.st.id,
		                      	hsid : data.st.hsid,
		                      	type : "user.refresh",
		                      	data : {
		                      		user : users[data.st.hsid]
								}
		                    }
		                );
		            }

					callback({});
				},
				reject = function(data){

					callback({errors : data})
				},
				where = {};

			if(sid){

				where.sid = sid;
			}

			!_.isEmpty(where) 
				? models.sid.destroy({where: where}).then(resolve, reject)
				: reject({where : 'Where Empty'});
		},

		/** Смена статуса */
		userChangeStatus : function(data, callback){
				
			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(user){

					if( !_.isEmpty(user) ){

						var status = 0;

						if( !data.offline ){
							
							status = 2;

							_.each(data.storage.pages[data.st.hsid], function(noop, url){

								if( /room/i.test(url) ){

									status = 1;

									return false;
								}
							});
						}

						models.sid.update(
							{status : status}, {
								where : {
									uid : user.id
								}
							}
						).then(function(){

							var response = {
	                      		uid : user.id,
	                      		status : status
							};

							data.io.sockets.emit(
			                    'api:userChangeStatus', {
			                      	id : data.st.id,
			                      	hsid : data.st.hsid,
			                      	data : response
			                    }
			                );

							callback(response);

						}, reject);	
					
					}else{

						reject();
					}
				},
				reject = function(data){

					callback({errors : data})
				},
				where = {
					admin : true
				},
				select = ['id'];

			if(sid){

				where.sid = sid;
			}

			!_.isEmpty(where) 
				? utils.getUser(where, select).then(resolve, reject)
				: reject({where : 'Where Empty'});
		},

		/** User Info */
		userInfo : function(data, callback){

			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(response){

					callback(response || {});
				},
				reject = function(data){

					callback({errors : data})
				},
				where = {},
				select = ['id', 'name', 'company', 'position', 'admin', 'email', 'avatar'];

			if(sid){

				where.sid = sid;
			}

			!_.isEmpty(where) 
				? utils.getUser(where, select).then(resolve, reject)
				: reject({where : 'Where Empty'});
		},

		/** User Update */
		userUpdate : function(data, callback){

			var 
				sid = _.trim(data['connect.sid']),
				resolve = function(prms){

					prms = prms || {};

					callback(prms);
				},
				reject = function(data){

					callback({errors : data})
				},
				update = function(user, valid){

					if( !_.isEmpty(valid) ){
						
						if(	_.has(valid, 'pass') ){
							
							valid.password = utils.genHash(valid.pass);
						}

						var isAvatarRemoveOld = false;

						if(valid.avatar){

							if(valid.avatar != user.avatar){
								
								var 
									oldPath = dirs.uploads + '/temp/' + valid.avatar,
									name = 'avatar_' + Date.now() + '_' + oldPath.match(/\..*$/)[0];
									newPath = dirs.uploads + '/' + name;

								try{
								 	
								 	fs.statSync(oldPath)

									fs.renameSync(oldPath, newPath);

									valid.avatar = name;

									isAvatarRemoveOld = true;

								}catch(e){

									delete valid.avatar;
								}
							}
						
						}else{

							isAvatarRemoveOld = true;
						}

						if(isAvatarRemoveOld){

							try{
									
								if(user.avatar && fs.statSync(dirs.uploads + '/' + user.avatar) ){

									fs.unlinkSync(dirs.uploads + '/' + user.avatar);
								}
							
							}catch(e){}
						}

						models.user.update(
							valid, {
								where : {
									id : user.id
								}
							}
						).then(function(){

							resolve({fields : _.keys(valid) });

						}, reject);
						
					}else{

						resolve({fields : []});
					}
				},
				where = {},
				select = ['id', 'password', 'email', 'avatar'];

			if(sid){

				where.sid = sid;
			}

			if( !_.isEmpty(where) ){

				var valid = utils.valid(data);

				if( _.isEmpty(valid.errors) ){

					utils.getUser(where, select).then(function(user){

						if( !_.isEmpty(user) ){
							
							if(valid.email && valid.email !== user.email){

								utils.getUser({email : valid.email}, ['id']).then(function(detect){

									if( !_.isEmpty(detect) ){

										reject({email: 'Этот E-mail привязан к другому пользователю'});
									
									}else{

										update(user, valid.valid);
									}

								}, reject);
							
							}else{

								update(user, valid.valid);
							}

						}else{

							reject({user: 'Пользователь не найден'});
						}

					}, reject);

				}else{

					reject(valid.errors);
				}

			}else{

				reject({where : 'Where Empty'});
			} 
		}
	};

module.exports = methods;
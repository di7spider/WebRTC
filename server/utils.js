var
	_ = require('lodash'),
	crypto = require('crypto'),
	fs = require('fs'),
	models = require(__dirname + '/models'),
	utils = {

		/** Отладка */
		debug : new console.Console(
	      	fs.createWriteStream(dirs.log + '/stdout.log'), 
	      	fs.createWriteStream(dirs.log + '/stderr.log')
	    ),

		/** Валидация полей */
		valid: function(data) {

			data = data || {};

			var 
				/** Правила */
				rules = {
					userLogin : [ 'email|r', 'pass|r'],
					userReg : ['email|r', 'pass|r', 'name|r'],
					userUpdate : ['email|r', 'company', 'name|r', 'position', 'pass', 'avatar'],
					adminReg :  ['email|r', 'company|r', 'position|r', 'name|r', 'pass|r', 'avatar']
				},

				/** Ошибки */
				errors = {
					'empty': _.template("Поле <%= name %> не должно быть пустым"),
					'no_valid': _.template("Неправильно заполнено поле <%= name %>"),
					'min_max': _.template("Поле <%= name %> должно быть минимум 6 максимум 12 символов")
				},

				/** Callback */
				cb = {
					pass : function(value, requre, is){

						if(requre || is){

							if( !value ){ 
							
								return 'empty'; 
							
							}else if(value.length < 6){ 
							
								return 'min_max'; 
							}
						}
					},
					str : function(value, requre, is){

						if(requre || is){

							if( !value ){ 
							
								return 'empty'; 
							}
						}
					},
					all : function(value, requre, is){

						if(requre && !value ){

							return 'empty';
						}
					}
				},

				/** Поля */
				fields = {
					email : {
						name : 'E-mail',
						rule : function(value, requre, is){

							if(requre || is){

								if( !value ){ 
								
									return 'empty'; 
								
								}else if( !(/.+@.+\..+/i.test(value)) ){ 
								
									return 'no_valid'; 
								}
							}
						}
					},
					pass : {
						name : 'Пароль',
						rule : cb.pass 
					},
					name : {
						name : 'Имя',
						rule : cb.str
					},
					company : {
						name : 'Компания',
						rule : cb.all
					},
					position : {
						name : 'Должность',
						rule : cb.all
					},
					avatar : {
						name : 'Аватар',
						rule : cb.all
					}
				},

				/* Ответ */
				result = {
					errors : {},
					valid : {} 
				};

			_.each(rules[data.rule], function(str){	
	
				var 
					list = str.split("|"),
					key = list[0],
					val = _.trim(data[key]),
					err = errors[ 
						fields[key].rule( 
							val, 
							list[1], 
							_.has(data, key) 
						) 
					];

				if(err){

					result.errors[key] = err(fields[key]); 
				
				}else if( _.has(data, key) ){

					result.valid[key] = val;
				}
			});

			return result;
		},

		/** Формирует HASH от строки */
		genHash: function(str, params) {

			params = params || {}
		
			return (
				crypto.createHash('md5')
					.update( _.trim(str) )
					.update(params.salt || 'sfyjsbnvci86405&*()&bdbnf')
					.digest('hex')
			);
		},

		/** Получение данных пользователя */
		getUser: function(where, select) {

			if(where.sid){

				return utils.getSid({sid : where.sid}, ['uid']).then(function(res){

					return _.isEmpty(res) ? {} : utils.getUser({id : res.uid}, select);
				});
			
			}else{

				var query = {
					where: where
				};

				if(select && select.length){

					query.attributes = select;
				}

				return models.user.findOne(query);
			}
		},

		/** Получение данных по авторизации */
		getSid: function(where, select) {

			var query = {
				where: where
			};

			if(select && select.length){

				query.attributes = select;
			}

			return models.sid.findOne(query);
		},

		/** Генерит строку */
		genStr : function(num){

	        var 
	        	text = "",
	            possible = "abcdefghijklmnopqrstuvwxyz",
	            num = num || 6;

	        for(var i = 0; i < num; i++){

	            text += possible.charAt(
	            	Math.floor(_.now() % Math.random() * possible.length) 
	            );
	        }

	        return text;
	    }
	};

module.exports = utils;
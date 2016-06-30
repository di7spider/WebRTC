module.exports = function(server){

    var 
        io = require('socket.io')(server),
        _ = require('lodash'),
        cookie = require('cookie'),
        api = require(__dirname + '/api'),
        utils = require(__dirname + '/utils'),
        storage = {
            pages : {},
            conn : {},
            messages : {},
            users : {}
        },
        connRefresh = function(st, data){

            var client = io.sockets.connected[st.id] || {};

            client.data = _.extend(
                {},
                client.data || {}, 
                data || {}, {
                    id : st.id,
                    hsid : st.hsid 
                }
            );

            return client.data;
        }, 
        getUserInfo = function(st, cb){

            if(st.room && cb){
            
                api.userInfo(
                    st.cookies, 
                    function(data){

                        var 
                            val = data.dataValues,
                            users = storage.users[st.room] = storage.users[st.room] || {},
                            user = users[st.hsid] = users[st.hsid] || {};

                        if( _.isEmpty(val) && _.isEmpty(user) ){

                            val = {
                                name : 'Участник ' + (_.keys(users).indexOf(st.hsid) + 1)
                            };

                            users.name = val.name;
                        }

                        users[st.hsid] = _.extend(user, val || {});

                        cb(users[st.hsid]);
                    }
                );
            }
        };

    io.on('connection', function(st){

        var  
            cookies = cookie.parse(
                st.request.headers.cookie
            ) || {},
            hsid = utils.genHash(
               cookies['connect.sid'] 
            );

        st.hsid = hsid;

        storage.conn[hsid] = st.id;

        storage.pages[hsid] || (storage.pages[hsid] = {});
        storage.pages[hsid][st.handshake.headers.referer] = 1;
       
        /** Обработчик запросов к API */
        st.on('api', function(prms, cb){

            _.has(api, prms.method)
                ? api[prms.method](
                    _.extend({}, cookies, prms.send || {}, {
                        st : st, 
                        io : io, 
                        storage : storage
                    }), 
                    cb
                )
                : cb({
                    errors : 'Запрашиваемый метод не найден'
                })
        });

        /** Обработчик запросов к комнате */
        st.on('room', function(prms, cb){

            prms = prms || {};

            var 
                type = prms.type,
                data = prms.data,
                room = prms.room,
                result = {};

            if(room){

                if(st.room && st.room != room){

                    st.leave(st.room);
                }
        
                st.join(room);

                st.room = room;
                st.cookies = cookies;

                if(type == 'init'){

                    return getUserInfo(st, function(user){

                        var conn = connRefresh(st, {}); 

                        /** Передаем объект сообщений чата в комнате */
                        result.messages = storage.messages[room] || [];

                        /** Передаем объект с информацией об пользователях  */
                        result.users = storage.users[room] || {};
                        
                        /** Передаем объект connected в комнате */
                        result.connected = {};

                        result.conn = conn;

                        _.each(io.sockets.adapter.rooms[room].sockets, function(v, id){
                     
                            result.connected[id] = io.sockets.connected[id].data || {};
                        });

                        /** Отправить всем клиентам в комнате, кроме отправителя */
                        st.broadcast.to(room).emit(
                            'room', {
                              id : st.id,
                              hsid : st.hsid,
                              type : 'user.connected',
                              data : {
                                conn : conn,
                                user : user
                              }
                            }
                        );

                        cb(result);
                    });

                }else if(type == 'state'){ /** Передача состояния пользователя (подкючен/отключен/стримит) */

                    /** Отправить всем клиентам в комнате, кроме отправителя */
                    st.broadcast.to(room).emit(
                        'room', {
                          id : st.id,
                          hsid : st.hsid,
                          type : type,
                          data : connRefresh(st, data) 
                        }
                    );

                }else if(type == 'message'){ /** Отправка сообщения */

                    var messages = storage.messages[room] = storage.messages[room] || [];

                    data.id = st.id;
                    data.hsid = st.hsid;

                    /** Сохраняем сообщение */
                    messages.push(data);

                    /** Отправить всем клиентам в комнате */
                    io.sockets.in(room).emit(
                        'room', {
                          id : st.id,
                          hsid : st.hsid,
                          type : type,
                          data : data 
                        }
                    );

                }else if(
                    prms.id && (
                      type == 'sdp' || 
                      type == 'candidate' || 
                      type == 'reconect.peer'
                    ) 
                ){
                    /** Отправить пользователю */
                    io.sockets.connected[prms.id].emit(
                        'room', {
                          id : st.id,
                          hsid : st.hsid,
                          type : type,
                          data : data 
                        }
                    ); 
                } 
            }

            cb(result);
        
        }).on('disconnect', function(){ /** Отключение */

            delete storage.conn[st.hsid];
            delete storage.pages[hsid][st.handshake.headers.referer];

            setTimeout(function(){

                var send = {};

                if(_.size(storage.pages[hsid]) <= 0){ /** Если пользователь ушёл с сайта */
                    
                    send = {offline : true};
                
                }else if( !_.has(storage.pages[hsid], st.handshake.headers.referer) ){ /** Закрыл страницу */

                    send = {offline : false};
                }

                if( !_.isEmpty(send) ){

                    api.userChangeStatus(
                        _.extend({}, cookies, {
                            st : st, 
                            io : io, 
                            storage : storage
                        }, send), 
                        function(){}
                    );
                }                 

                if(st.room){    
                    
                    /** Удаляем накопившиеся сообщения комнаты, если все пользователи вышли из нее */            
                    if( !_.size(io.sockets.adapter.rooms[st.room]) ){

                        storage.messages[st.room] = []; 
                        storage.users[st.room] = {}; 
                    }

                    /** Отправить всем клиентам в комнате, кроме отправителя */
                    st.broadcast.to(st.room).emit(
                        'room', {
                          id : st.id,
                          hsid : st.hsid,
                          type : 'state',
                          data : {
                            id : st.id,
                            isStream : false,
                            isDisconnect : true
                          }
                        }
                    );
                }

            }, 5000);
        });
    
    });
}
/** https://github.com/muaz-khan/WebRTC-Experiment/blob/master/websocket-over-nodejs/public/one-to-one-peerconnection.html */
$(function(){
    
    "use strict";

    /** Алиасы на системные объекты браузера */
    var 
        _url = (
            window.URL || 
            window.webkitURL
        ),

        _peer = (
            window.RTCPeerConnection || 
            window.webkitRTCPeerConnection || 
            window.mozRTCPeerConnection || 
            window.msRTCPeerConnection
        ),

        _session = (
            window.RTCSessionDescription || 
            window.webkitRTCSessionDescription || 
            window.mozRTCSessionDescription ||
            window.msRTCSessionDescription
        ),

        _candidate = (
            window.RTCIceCandidate  ||
            window.webkitRTCIceCandidate ||
            window.mozRTCIceCandidate ||
            window.msRTCIceCandidate
        ),

        _audio = (
            window.AudioContext || 
            window.webkitAudioContexеt
        );

    navigator.getUserMedia = (
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia
    );

    /** DOM */
    var dom = {
        parent : $('.app-wrap-main'),
        main : $('[app-media-wrap="main"]'),
        local : $('[app-media-wrap="localSteram"]'),
        remote : $('[app-media-wrap="listRemoteSteram"]'),
        chat : $('[app-media-wrap="chat"]'),
        online : $('[app-media-wrap="online"]')
    };

    /** Настройки */
    var options = { 
        
        /** Локальный стрим текущего пользователя */
        stream : null,

        /** ID комнаты */
        room : ( location.pathname.match(/\/room\/([^/]+)\/?$/) || [] )[1],

        /** Параметры разрешения локального стрима (видео/аудио) */
        constr : { 
          audio: true, 
          video: true
        },

        /** Настройки для микрофона */
        microfone : {
            context : null,
            value : 0.5,
            filter : {
                gain : {
                    value : 0.5
                }
            }
        },

        /** Доступы для SDP */
        sdpParams : { 
            mandatory : { 
                OfferToReceiveAudio : true, 
                OfferToReceiveVideo : true 
            } 
        },

        /** Пользователи в комнате */
        connected : {},

        /** Пользователи */
        users : {},

        /** Пиры */
        peers : {},
        
        /** Стартовые параметры для RTCPeerConnection */
        pearParams : null,

        /** Стартовые доп. параметры для RTCPeerConnection */
        pearAdditional : null
    };

    /** Socket IO */
    var socket = $.api.socket;

    /** Отправляет сообщение на сервер */
    function emit(params, callback){

        params = params || {};

        console.log('>> Socket [emit_ROOM][send_' + params.type + ']: ', params);

        socket.emit(
            'room', 
            $.extend({
                    room : options.room
                }, 
                params || {}
            ),
            function(res){

                console.log('>> Socket [emit_ROOM][response_' + params.type + ']: ', res);

                callback && callback(res);
            }
        );
    }

    /** Выводит ошибки */
    function err(){

        console.log('--> Error: ', arguments);
        console.trace();

        alert( 'Ошибка: ' + JSON.stringify(arguments) );
    }

    /** Инициализируем локальный стрим */
    function local(){

        if(options.constr.video == false && options.constr.audio == false){

            media(null);
        
        }else{

            /** Запрос разрешения и получение video стрима от пользователя */
            navigator.getUserMedia(options.constr, media, err); 
        }      
    }

    /** Устанавливает / Обновляет локальный стрим */
    function media(stream){

        var isLocal = !!options.stream;

        if(!stream && isLocal){

            /** Останавливаем все треки стрима (виде/аудио) */
            _.each(options.stream.getTracks(), function(track){
                    
                track.stop();
            });
        }

        /** Сохраняем локальный стрим текущего пользователя */
        options.stream = stream;

        /** Инициализируем настройки микрофона */
        microfone('init');

        /** Добавляем стрим к тегу video */
        dom.local.attr('src', stream ? _url.createObjectURL(stream) : '');

        /** Отправляем событие, определяющие готовность текущего пользователя к трансляции */
        emit({
            type : 'state',
            data : {
                isStream : stream ? true : false
            }
        }, function(){

            /** Cинхронизируем пиры */
            _.each(options.connected, function(connected){
            
                peer(connected);  
            });
        });
    } 

    /** Инициализируем настройки микрофона */
    function microfone(action, params){

        try{
            
            params = params || {};

            var microfone = options.microfone;

            if(action == 'init'){

                if(options.stream && options.constr.audio){
                    
                    microfone.context = microfone.context || new _audio();
                    
                    var 
                        microphone = microfone.context.createMediaStreamSource(options.stream),
                        destination = microfone.context.createMediaStreamDestination(),
                        output = destination.stream;

                    microfone.filter = microfone.context.createGain();

                    /** Громкость */
                    microfone.filter.gain.value = microfone.value;

                    microphone.connect(microfone.filter);
                    microfone.filter.connect(destination);
            
                    options.stream.addTrack(output.getAudioTracks()[0]);
                    options.stream.removeTrack(options.stream.getAudioTracks()[0]);
                }

            }else if(action == 'volume'){ /** Громкость */

                var volume = parseFloat(params.volume);

                microfone.filter.gain.value = volume;
                microfone.value = volume;
            }
        
        }catch(e){

            alert('Произошла ошибка подключения веб камеры :(');
        }
    }

    /** Создате peer */
    function peer(params){

        params = params || {};

        var 
            id = params.id,
            type = params.type || 'offer',
            callback = params.callback || function(){};

        if(id && id != socket.id){

            var peer = options.peers[id];
              
            if( !options.stream || !params.isStream ){  /** Если локальный стрим пользователя или стрим собеседника прерван */

                peer = closePeer(id);

                params.isStream
                    ? stopRemoteStream(id) 
                    : removeRemoteStream(id);
            
            }else if( !peer ){ /** Создаем Peer */

                peer = new _peer(options.pearParams, options.pearAdditional);

                peer.addStream(options.stream);
                
                peer.onaddstream = function(event){

                    addRemoteStream(event.stream, params); 
                };

                peer.onicecandidate = function(event){
                    
                    if(event.candidate) {

                        emit({
                            type : 'candidate',
                            id : id,
                            data : {
                                sdpMLineIndex : event.candidate.sdpMLineIndex,
                                candidate : event.candidate.candidate
                            }
                        });
                    }
                };

                callback(peer);

                offerAnswer(peer, type, id);   
            
            }else{ /** Если соединение было установлено ранее */

                var stream = _.first(
                    peer.getLocalStreams()
                );

                if(stream != options.stream){ /** Заменяем стрим */
                    
                    if(peer.localDescription.type == 'offer'){

                        peer.removeStream(stream);
                        peer.addStream(options.stream);
                  
                        offerAnswer(peer, peer.localDescription.type, id); 
                    
                    }else{ /** @TODO: Hack Если Answer */

                        return reconnectPeer(id);
                    }
                }

                callback(peer);
            }

            options.peers[id] = peer; 

            console.log('>> Peers: ', options.peers);
        }
    }

    /** Переподключение к Peer */
    function reconnectPeer(id){

        if(id){

            closePeer(id);

            emit({
                type : 'reconect.peer',
                id : id,
                data : {}
            });
        }
    }

    /** Закрывает соединение Peer */
    function closePeer(id){

        if( options.peers[id] ){
            
            options.peers[id].close(); 
            options.peers[id] = null;
        }

        return options.peers[id];
    }

    /** Создает Offer / Answer */
    function offerAnswer(peer, type, id){

        peer[type == 'answer' ? 'createAnswer' : 'createOffer'](function(sdp){
                    
            peer.setLocalDescription(sdp);

            emit({
                type : 'sdp',
                id : id,
                data : sdp
            });

        }, err, options.sdpParams); 
    }

    /** Инициализация удаленных стримов */
    function initRemoteStreams(){

        _.each(options.connected, function(connected){

            if(connected.isStream){

                addRemoteStream(null, connected);  
            }
        });
    }

    /** Останавливает удаленный стрим */
    function stopRemoteStream(id){

        var video = dom.remote.find("[app-media-wrap='remoteSteram'][data-id='" + id + "']");

        if(video.length){

            video.attr('src', ' ');
        }
    }

    /** Удаляет удаленный стрим */
    function removeRemoteStream(id){

        dom.remote.find("[app-media-wrap='remoteSteram'][data-id='" + id + "']").remove();
    }

    /** Добавляет удаленный стрим */
    function addRemoteStream(stream, params){

        params = params || {};

        var id = params.id;

        if(id != socket.id){
            
            var video = dom.remote.find("[app-media-wrap='remoteSteram'][data-id='" + id + "']");

            video = (
                video.length 
                    ? video 
                    : $('<video autoplay data-id="' + id + '" class="app-wrap-media-remote-steram" app-media-wrap="remoteSteram"></video>')
                        .appendTo(dom.remote)
            );

            stream && video.attr('src', _url.createObjectURL(stream) );
        }
    }

    /** Добавить сообщение в чат */
    function addMessChat(data){

        if( !_.isEmpty(data) ){

            var 
                user = options.users[data.hsid] || {},
                date = new Date(data.date),
                minutes = date.getMinutes();

            if ( minutes < 10 ) {

                minutes = '0' + minutes;
            }

            if(socket.hsid == data.hsid){

                dom.chat.find('.field-mess').append(
                    '<div class="mess-this">'+
                        '<span style="top: 14px;font-size: 13px;" class="mess-date">' + date.getHours() + ':' + minutes + '</span>'+
                        '<div class="mess-cont">'+
                            '<div class="mess">'+  _.escape(data.message) +
                          '</div>'+
                          '<div class="mess-author">' + 
                            '<img src="' + (user.avatar ? '/uploads/' + user.avatar : '/client/img/img.avatar.png') +'">' +
                            '<span>Вы</span>' +
                            '</div>'+
                        '</div>'+
                    '</div>'
                );

            }else{

                dom.chat.find('.field-mess').append(
                    '<div class="mess-to">'+
                        '<div class="mess-cont">'+
                            '<div class="mess-author">'  + 
                                '<img src="' + (user.avatar ? '/uploads/' + user.avatar : '/client/img/img.avatar.png') +'">' +
                                '<span>' + 
                                    user.name +  (
                                    user.nameOld ? ' (' + user.nameOld + ')' : ''
                                ) +
                                '</span>' +
                            '</div>'+
                          '<div class="mess">' + _.escape(data.message) + '</div>'+ 
                        '</div>'+'<span style="top: 14px;float: right;font-size: 13px;" class="mess-date"> ' + date.getHours() + ':' + minutes + '</span>'+
                    '</div>'
                );
            }

            
            var 
                height = $('.field-mess').height(),
                scroll = $('.chat-content');

            scroll.scrollTop(height);
        }
    }

    /** Пользователь */
    function user(id, hsid, action){

        if(id != socket.id){
            
            console.log("--> User: ", id, hsid, action);

            var 
                wrap = dom.online.find('[data-hsid="' + hsid + '"]'),
                user = options.users[hsid];

            if(action == 'add'){

                (wrap.length ? wrap : $('<li data-hsid="' + hsid + '"></li>').appendTo(dom.online) ).html(
                    '<img src="' + (user.avatar ? '/uploads/' +  user.avatar : '/client/img/img.avatar.png') +'">' +
                    '<span>' +
                        user.name + (
                            user.nameOld ? ' (' + user.nameOld + ')' : ''
                        ) +
                    '</span>'
                ).addClass(socket.hsid == hsid ? 'app-user-curr' : 'app-user-other');

            }else if(action == 'remove'){

                wrap.length && wrap.remove();

                delete options.connected[id];
            }
        }
    }

    /** Получаем с сервера стартовые параметры */
    emit({type : 'init'}, function(data){

        options.connected = data.connected;
        options.users = data.users;

        initRemoteStreams();

        socket.hsid = data.conn.hsid;

        _.each(options.connected, function(value){

            user(value.id, value.hsid, 'add');
        });

        _.each(data.messages, addMessChat);
    });

    /** Обработчик для WEB RTC */
    socket.on('room', function(params){
        
        params = params || {};

        console.log('>> Socket [on][response_' + params['type'] + ']: ', params);
        console.log('>> Socket [on][options]: ', options.users);

        var 
            type = params.type,
            data = params.data;

        if(type && data){
            
            if(type == 'user.connected' || type == 'user.refresh'){
                
                if(type == 'user.connected'){
                    
                    options.connected[params.id] = data.con;
                }

                options.users[params.hsid] = data.user; 

                user(params.id, params.hsid, 'add');
            
            }else if(type == 'state'){ /** Передача состояния пользователя (подкючен/отключен/стримит) */

                options.connected[params.id] = data;

                if(data.isStream){ /* Подключение */

                    initRemoteStreams();

                }else{ /** Отключение */

                    peer(data);
                }

                if(data.isDisconnect){

                    user(params.id, params.hsid, 'remove');
                }
          
            }else if(type == 'reconect.peer'){

                closePeer(params.id);

                peer(
                    options.connected[
                        params.id
                    ]
                );

            }else if(type == 'sdp' || type == 'candidate'){ 

                var connected = options.connected[params.id];

                if(connected){

                    peer(
                        _.extend({}, connected, {
                            type : 'answer',
                            callback : function(peer){

                                if(type == 'sdp'){ /** Обмен SDP */

                                    peer.setRemoteDescription( new _session(data) );
                                
                                }else if(type == 'candidate'){ /** Обмен Сandidate */

                                    peer.addIceCandidate( new _candidate(data) );
                                } 
                            }
                        })
                    );
                }
            
            }else if(type == 'message'){

                addMessChat(data);
            }
            
        }else{

            err('room', params);
        } 
    });
        
    dom.main
        .on('click', '[app-media-btn-connect]', function(){ /** Обработчик кнопок создания локального стрима (видео/аудио) */

            var 
                item = $(this),
                type = item.attr('app-media-btn-connect'),
                isConstr = false;

            if(type != 'close'){
               
               options.constr[type] = !item.hasClass('app-btn-on');
            }

            if(type == 'audio' && options.constr.audio && !options.stream){

                options.constr.video = false;
            
            }else if(type == 'close'){

                _.each(options.constr, function(is, type){
                    
                    options.constr[type] = false; 
                });
            }

            _.each(options.constr, function(is, t){

                isConstr = is || isConstr;

                var butt = dom.main.find('[app-media-btn-connect="' + t + '"]');

                if(type == 'close'){

                    butt
                      .removeClass('app-btn-off app-btn-on');

                }else{
                    
                    butt
                      .addClass(is ? 'app-btn-on' : 'app-btn-off')
                      .removeClass(is ? 'app-btn-off' : 'app-btn-on');
                }
            });

            dom.main.find('[app-media-btn-connect="close"]')[
                isConstr ? 'removeClass' : 'addClass'
            ]('app-btn-hide');

            local();
        })
        .on('change', '[app-media-btn-control="microfone"]', function(){ /** Обработчик изменения громкости микрофона */

            microfone(
                'volume', {
                    volume : $(this).val()
                }
            );
        });

    dom.parent.find('[data-btn="room-name"] > span').text(
        window.location.href
    );

    /** Скопировать ID комнаты */
    dom.parent.on('click', '[data-btn="room-name"]', function(){

        var 
            item = $(this),
            room = $.trim(item.text() ),
            input = item.find('input');

        if( document.queryCommandSupported('copy') ){

            input.val(room).show().select();
            document.execCommand("copy");
            input.hide();

            alert("Идентификатор комнаты скопирован в буфер обмен");
        
        }else{

            alert("Ваш браузер не поддерживает копирование в буфер обмена");
        }
    });

    /** Отправка сообщения в чат */
    function sendChat(){

        var 
            text = dom.chat.find('[app-media-text="message"]'),
            data = null,
            message = $.trim(
                text.val()
            );

        if(message){

            data = {
                date : new Date().toString(),
                message : message
            };

            text.val(null);

            emit({
                type : 'message',
                data : data
            });
        }
    }

    dom.chat
        .on('click', '[app-media-btn="send_message"]', sendChat)
        .keydown(function(e){
            
            e.keyCode === 13 && sendChat();
        });
});  
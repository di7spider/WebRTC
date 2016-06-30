$(function(){

    var 
        ids = [1, 2, 3, 4],
        rand = Math.floor(Math.random() * ids.length);

    /** Смена фонового изображения */
    $('.app-wrap-bk').attr(
        'style', 
        'background: url("/client/img/img.pattern.png") 0% 0%/auto padding-box border-box, url("/client/img/background/' + rand + '-min.jpg") no-repeat 50% 50%/cover padding-box border-box !important'
    );

    /** Фокус на инпуте */
    $('input[name="getRoom"]').focus();

    /** Перейти в комнату */
    $('[data-btn="nextRoom"]').on('click', function(e){

        e.preventDefault();
        e.stopPropagation();

        var 
            item = $(this),
            input = item.prev('input[name="getRoom"]'),
            room = $.trim(input.val() );

        if(room){

        	var temp = ( room.match(/\/room\/([^/]+)\/?$/) || [] )[1];

            window.location.href = '/room/' + (temp ? temp : room);
        
        }else{

            $.api.query({method : 'nowRoom'}, function(room){
                
                window.location.href = '/room/' + room;
            });
        }
    });

    var 
        employees = $('.app-wrap-employees .app-wrap-users'),
        status = {
            0 : 'Нет на месте',
            1 : 'Занят',
            2 : '<span class="app-status-icon">&#xe80c;</span>'
        };

    /** Список сотрудников на главной */
    $.api.query({method : "employeesList"}, function(list){

        _.each(list, function(item){

            employees.append(
                '<div data-status="' + item.status + '" data-hsid="' + (item.hsid || "") + '" data-uid="' + item.id + '" data-wrap="employee" class="app-wrap-user app-active-status-' + item.status + '">' +
                    '<div class="app-wrap-avatar">' +
                        '<img src="' + (item.avatar ? '/uploads/' + item.avatar : '/client/img/img.avatar.png') + '" alt="' + item.name + '">' + 
                    '</div>' +
                    '<p class="app-name">' + item.name + '</p>' +
                    '<p class="app-position">' + item.position + '</p>' +
                    '<span class="app-status">' + status[item.status] + '</span>' +
                '</div>'
            );
        });
    });

    /** Отправить приглашение пользователю */
    employees.on('click', '[data-wrap="employee"]', function(){

        var 
            item = $(this),
            status = parseInt(item.attr('data-status'), 10),
            uid = parseInt(item.attr('data-uid'), 10),
            hsid = item.attr('data-hsid') || "",
            currUid = parseInt( $('[data-wrap="btn-auth"]').attr('data-uid'), 10);

        if(uid > 0 && status == 2 && currUid != uid){

            $.api.query({method : 'nowRoom'}, function(room){
                
                $.api.query(
                    {
                        method : "userToRoom", 
                        send : {
                            uid : uid,
                            hsid : hsid,
                            room : room,
                            userName : $('[data-btn="personal"] span').text()
                        }
                    }, 
                    function(item){

                        if(item.error){
            
                            alert(item.error);

                        }else{
                            
                            window.location.href = '/room/' + room;
                        }
                });
            });
        }
    });

    /** Обработчик смены статуса */
    $.api.on('userChangeStatus', function(item){

        item = item.data;

        employees.find('[data-wrap="employee"][data-uid="' + item.uid + '"]')
            .removeClass()
            .addClass('app-wrap-user app-active-status-' + item.status)
            .attr('data-status', item.status)
            .attr('data-hsid', item.hsid)
            .find('.app-status').html(
                status[item.status]
            );
    });
})

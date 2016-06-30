$(function(){
	
	var forms = $('[data-form="auth"], [data-form="reg"]');

	/** Успешно или нет */
	function toggle(user){

        var 
            wrap = $('[data-wrap="btn-auth"]'),
            btn1 = wrap.find("[data-btn='login'], [data-btn='reg']"),
            btn2 = wrap.find("[data-btn='personal'], [data-btn='logout']");

        if( !_.isEmpty(user) && !_.has(user, 'errors') ){

            btn1.hide();

            btn2.find('> a > span').text(user['name']);

            btn2.find('> a > img').attr(
                'src', 
                !user.avatar 
                    ? '/client/img/img.avatar.png' 
                    : '/uploads/' + user['avatar']
            );

            btn2.show();

            wrap.attr('data-uid', user.id);

            $.api.query({method : "userChangeStatus"});

        }else{
            
            btn2.hide();
            btn1.show();
        }
    }

    /** Получаем инфу при загрузке страницы */
    $.api.query({method : "userInfo"}, toggle);

    /** Переключение блоков */
    $('[data-toggle]').on('click', function(){

        var 
        	item = $(this),
            form = $(item.attr('data-toggle') );

        $('[data-form]').not(form).removeClass('app-active-form');

        form.toggleClass('app-active-form');
    })

    /** Закрыть форму */
    forms.on('click', '[data-btn="close"]', function(){
        
       $(this).parent('form.app-active-form').removeClass('app-active-form');
    });

    /** Разлогин */
    $('[data-btn="logout"]').on("click", function(){

        $.api.query({method : "userLogout"}, toggle);
    });

    /** Регистрация / Авторизация Success */
    $(document).on('evt.form.login.reg', function(e, result){

        forms.removeClass('app-active-form');   
        toggle(result);
    });
});
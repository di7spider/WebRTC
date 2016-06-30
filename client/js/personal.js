$(function(){
  
  /** Если пользователь не зарегистрирован, то перекидываем его на главную */
  $.api.query({method : "userInfo"}, function(user){

      if(_.isEmpty(user) || user.errors){

          window.location.href = '/';
      
      }else{

        $('[data-form="personal.edit"] .app-field').each(function(){

            var 
                item = $(this),
                name = item.attr('name');

            if( _.has(user, name) ){

                item.val(user[name]);

                if(item.is('[picture-name]') && user[name]){

                    item.prevAll('.app-wrap-img')
                      .html(
                        '<img src="/uploads/' + user[name] + '" >'
                      )
                      .append(
                        '<span title="Удалить изображение" data-btn="img-remove" class="app-btn-img-remove"></span>'
                      );
                }
            }
        });
      }
  });

  /** Выход */
  $('[data-btn="logout"]').on("click", function(){

      $.api.query({method : "userLogout"}, function(){

          window.location.href = '/';
      });
  });

  /** Сохранение */
  $(document).on('evt.form.personal.edit', function(e, result){

      if(result.fields && result.fields.length ){
      
        alert('Информация успешно обновлена: ' + result.fields.join(", ") );
    
      }else{

        alert('Информация не изменилась');
      }
  }); 

});
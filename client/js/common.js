$(function(){

	var forms = $('[data-form]');

	/** Сброс ошибок при фокусе */
	forms.on('focus', '.app-field', function(){

	    var item = $(this);

	    if( item.hasClass('app-active-error') ){

	        item.removeClass('app-active-error').next('.app-error').html("");
	    }
	});

	/** Удалить аватар */
	forms.on('click', '[data-btn="img-remove"]', function(){

		var 
			btn = $(this),
			parent = btn.parent(),
			wrap = btn.closest('.app-wrap-file-picture'),
			input = wrap.find('[picture-name]'),
			cb = function(){

				parent.html(
					'<img src="/client/img/img.avatar.png">'
				);

				wrap.find('.app-file-loader').hide();

				input.val(null).removeAttr('temp');
			}

		if( !input.is("[temp]") ){

			cb();
		
		}else{

			$.api.query({method : "removeTempFile", send : {file : input.val() } }, function(response){

				if(!response.errors){

					cb();
				
				}else{

					alert("Не удалось удалить изображение");
				}
			});
		}
	});

	/** Файлы */
	forms.find('[type="file"][picture]').each(function(){

		var 
			name = this.name,
			input = $(this),
			field = input.prevAll('.app-field');

		FileAPI.event.on(this, 'change', function(evt){

			if(field.val() && field.is('[temp]') ){
				
				$.api.query({method : "removeTempFile", send : {file : field.val() } } );
			}
	        
	        var files = FileAPI.getFiles(evt); 

	        FileAPI.filterFiles(files, function(file, info){
	            
	            if( /^image/.test(file.type) ){
	                
	                return info.width >= 320 && info.height >= 240;
	            }
	            
	            alert("Загружаемый файл должен быть изображением (в ширину не менее 320px, в длину 240px)");

	            return false;
	        
	        }, function(files, rejected){

	            if(files.length){
	              	
	              	FileAPI.Image(files[0]).preview(450).get(function(err, canvas){

	                	var picture = FileAPI.Image(canvas);

	                	picture.type = 'image/png';
						picture.width = canvas.width;
						picture.height = canvas.height;
						picture.size = canvas.width * canvas.height * 4;

	                    input.prevAll('.app-wrap-img').html(canvas).append(
	                    	'<span title="Удалить изображение" data-btn="img-remove" class="app-btn-img-remove"></span>'
	                    );

	                    FileAPI.upload({
		                    url: '/picture',
		                    files: {picture: picture},
		                    progress: function(evt){

		                    	input.prevAll('.app-file-loader').css('display', 'block').find('span').text(
		                    		Math.round(evt.loaded / evt.total * 100) + '%'
		                    	);
		                    },
		                    complete: function(err, xhr){

		                    	if(!err){
		                    		
		                    		var response = $.parseJSON(xhr.response);

		                    		field.val(response.file).attr('temp', 'Y');
		                    	
		                    	}else{

		                    		alert("При загрузке изображения произошла ошибка");
		                    	}
		                    }
		                });
			            
	                });
	            }
	        });
	    });
	});
  
  	/** Обработчик кнопки send */
 	forms.on('click', "[data-btn='send']", function(e){

	    e.preventDefault();
	    e.stopPropagation();
	      
	    var 
	        item = $(this),
	        form = item.closest('form'),
	        method = form.data('method'),
	        evt = form.data('evt'),
	        fields = {};

	    if(method){
		    
		    form.find('.app-field').each(function(key, element){
		          
	          	element = $(element);

	          	var val = $.trim(element.val() );

	          	if( !( !val && element.is('[field-empty-no-send ]') ) ){
	          		
	          		fields[ element.attr('name') ] = val;
	          	}

	         	if( element.hasClass('app-active-error') ){

	              	element.removeClass('app-active-error').next('.app-error').html("");
	          	}
		    });

		    $.api.query({method : method, send : fields}, function(result){

	          	var error = result['errors'];

	          	if( !_.isEmpty(error) ){

	              	$.each(error, function(key, message){

	                  	form.find('[name="'+ key +'"]').addClass('app-active-error').next('.app-error').html(message);
	              	});

	          	}else if(evt){

	            	$(document).trigger(evt, [result, item, form]);
	          	}     
		    });
		}
  	});

  	/** Приглашение на вступление в команту */
    $.api.on('userToRoom', function(item){

    	if(item.data && item.data.room){

    		if( confirm('Запрос на общение от ' + ( item.data.userName ? item.data.userName : "неавторизованного пользователя" ) ) ){

    			window.location.href = '/room/' + item.data.room;
    		
    		}else{

    			$.api.query({
    				method : 'rejectToRoom', 
    				send : {
    					hsid : item.hsid,
    					userName : $('[data-btn="personal"] span').text()
    				}
    			});
    		} 		
    	}
    });

    $.api.on('rejectToRoom', function(item){

    	alert("Сотрудник " + item.data.userName + " на данный момент занят и не может присоединится к беседе");
    });
});
$(function(){

	/** Api */
	$.api = {
		socket : io.connect(window.location.origin),
		query : function(params, callback){

	        params = params || {};

	        console.log('>> Socket [emit_API][send_' + params.method + ']: ', params);

	        this.socket.emit(
	            'api', 
	            params,
	            function(res){

	                console.log('>> Socket [emit_API][response_' + params.method + ']: ', res);

	                callback && callback(res);
	            }
	        );
	    },
	    on : function(evt, callback){

	    	this.socket.on('api:' + evt, callback);
	    }
	}
});
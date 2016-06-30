var 
    config = require(dirs.root + '/config'),
    express = require('express'),
     _ = require('lodash'),
    app = express(),
    server = require('http').Server(app),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    store = require('express-sql-session')(session),
    multer = require('multer'),
    mime = require('mime'),
    auth = require('basic-auth'),
    upload = multer({
      storage : multer.diskStorage({
        destination: function(req, file, cb){
          cb(null, dirs.uploads + '/temp');
        },
        filename: function(req, file, cb){
          cb(null, file.fieldname + '_' + Date.now() + '.' + mime.extension(file.mimetype) );
        }
      })
    }),
    options = {
      root : dirs.client
    };

app.use(
  bodyParser.json()
); 

app.use(
  bodyParser.urlencoded({
    extended: true 
  })
); 

app.use(
  cookieParser()
);

app.use(
  session({ 
  	resave: true,
    saveUninitialized: true,
    secret: 'secret-webrtc',
    store: new store({
      client: config.db.dialect,
      connection: {
        host: config.db.host,
        port: config.db.port,
        user: config.db.login,
        password: config.db.pass,
        database: config.db.name
      },
      table: 'sessions'
    }),
    cookie: {
      expires: new Date(Date.now() + (60 * 60 * 24 * 7 * 1000)),
    }
  })
);

app.get('*', function(req, res, next){
    
    if(req.headers["x-forwarded-proto"] === "https"){
       
       return next();
    
    }else{
      
      res.redirect("https://" + req.headers.host + req.url);
    }
});

app.use(
  '/client',
  express.static(dirs.client)
);

app.use(
  '/uploads',
  express.static(dirs.uploads)
);

app.get('/', function(req, res){

  res.sendFile('index.html', options);
});

app.get('/personal/', function(req, res){

  res.sendFile('personal.html', options);
});

app.get('/admin/', function(req, res){
  
  	if(config.basic){
  	
  	 	var user = auth(req);

	    if( user === undefined || 
	        !(user['name'] == config.basic.login && user['pass'] == config.basic.pass) ){
	          
	        res.statusCode = 401;
	        res.setHeader('WWW-Authenticate', 'Basic realm="webrc"');
	        res.end('Доступ запрещен');
	      
	    }else{
	        
          res.cookie('auth_basic_admin', config.basic.login + '||' + config.basic.pass); 
	       	res.sendFile('admin.html', options);
	    }
	}
});

app.get('/room/:room', function(req, res){

  res.sendFile('room.html', options);
});

app.post('/picture', upload.single('picture'), function(req, res, next){

  res.send({
    file : req.file.filename
  });
});

app.use(function(req, res){
  
  res.status(404).send('Запрашиваемой страницы не существует :(');
});

server.listen(process.env.PORT || 5000);

module.exports = server;
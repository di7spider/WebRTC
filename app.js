global.dirs = {
	root : __dirname,
	log : __dirname + '/log',
	server : __dirname + '/server',
	client : __dirname + '/client',
	uploads : __dirname + '/uploads'
};

require(dirs.server + '/socket')(
	require(dirs.server + '/dispatcher')
);
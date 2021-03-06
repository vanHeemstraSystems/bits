/* BITS (default port 7xxx)
* The full REST API for this application consists of the following methods:
*
* Method	URL	Action
* GET	/services	Retrieve all services
* GET	/services/5069b47aa892630aae000001	Retrieve the service with the specified _id
* POST	/services	Add a new service
* PUT	/services/5069b47aa892630aae000001	Update service with the specified _id
* DELETE	/services/5069b47aa892630aae000001	Delete the service with the specified _id
*/
/**
* Module dependencies.
*/
var express = require('express'),
path = require('path'),
mime = require('mime'),
fs = require('fs'),
url = require('url'),
http = require('http'),
cors = require('cors'),
runner = require('child_process'),
morgan = require('morgan'),
partials = require('express-partials'),
device = require('../lib/device.js'),
hash = require('../lib/pass.js').hash,
redirect = require('express-redirect'),
bodyParser = require('body-parser'),
cookieParser = require('cookie-parser'),
i18n = require('i18n-2'),
methodOverride = require('method-override'),
errorHandler = require('errorhandler'),
sass = require('node-sass'),
sassMiddleware = require('node-sass-middleware'),
session = require('express-session'),
passport = require('passport'),
LocalStrategy = require('passport-local').Strategy,
FacebookStrategy = require('passport-facebook').Strategy;
/*
* CONFIGS - The Configurations
*/
var config = require('../configs/server.js');
var configs = config.configs;
var server_prefix = configs.server_prefix || 'BITS';
/*
* ROUTER - The Router
*/
var router = require('../routers/router.js');
/*
* ROUTES - The Routes
*/
var routes = require('../routes'); // it seems that we have to start each required file as its own var
/*
* SERVICES - The Services
*/
var services = require('../routes/services'); // it seems that we have to start each required file as its own var
var mqlService = require('../services/mql');
var testService = require('../services/test');
/*
* SERVER - The Server used for shutdown etc
* See: https://www.exratione.com/2011/07/running-a-nodejs-server-as-a-service-using-forever/
*/
var server = express();
// Port
if(typeof configs.server_port === 'undefined'){
	var server_port = process.env.PORT || 17080;
}
else {
	var server_port = configs.server_port;
}
server.listen(server_port);
console.log(server_prefix + " - Node Version: " + process.version);
console.log(server_prefix + " - Express server listening on port %d", server_port);
console.log(server_prefix + " - To shutdown server gracefully type: node prepareForStop.js");

server.get('/prepareForShutdown', function(req, res) {
	if(req.connection.remoteAddress == "127.0.0.1"
			|| req.socket.remoteAddress == "127.0.0.1"
			// 0.4.7 oddity in https only
			|| req.connection.socket.remoteAddress == "127.0.0.1")
	{
		managePreparationForShutdown(function() {
			// don't complete the connection until the preparation is done.
			res.statusCode = 200;
			res.end();
		});
	}
	else {
		res.statusCode = 500;
		res.end();
	}
});
// Manage prepare for shutdown
var managePreparationForShutdown = function(callback) {
	// perform all the cleanup and other operations needed prior to shutdown,
	// but do not actually shutdown. Call the callback function only when
	// these operations are actually complete.
	try {
		app.close();
		console.log(server_prefix + " - Shutdown app successful.");
	}
	catch(ex) {
		console.log(server_prefix + " - Shutdown app failed.");
	}
	try {
		api.close();
		console.log(server_prefix + " - Shutdown api successful.");
	}
	catch(ex) {
		console.log(server_prefix + " - Shutdown api failed.");
	}
	console.log(server_prefix + " - All preparations for shutdown completed.");
	callback();
};

/*
* APP - The Application
*/
var app = express();
// Port
if(typeof configs.app_port === 'undefined'){
	var app_port = process.env.PORT || 7000;
}
else {
	var app_port = configs.app_port;
}
// Group ID
if(typeof configs.app_gid === 'undefined'){
	var app_gid = "root";
}
else {
	var app_gid = configs.app_gid;
}
// User ID
if(typeof configs.app_uid === 'undefined'){
	var app_uid = "root";
}
else {
	var app_uid = configs.app_uid;
}
// App List
if(typeof configs.app_list === 'undefined'){
	var app_list = {};
}
else {
	var app_list = configs.app_list;
}
/*
* API- The Application Programming Interface
*/
var api = express();
// Port
if(typeof configs.api_port === 'undefined'){
	var api_port = app_port+1 || 7001;
}
else {
	var api_port = configs.api_port;
}
// Group ID
if(typeof configs.api_gid === 'undefined'){
	var api_gid = "root";
}
else {
	var api_gid = configs.api_gid;
}
// User ID
if(typeof configs.app_uid === 'undefined'){
	var api_uid = "root";
}
else {
	var api_uid = configs.api_uid;
}
// Api List
if(typeof configs.api_list === 'undefined'){
	var api_list = {};
}
else {
	var api_list = configs.api_list;
}

/*
* API DEVELOPMENT
*
* .bash_profile contains
* NODE_ENV=development
*
* or start server as follows
* NODE_ENV=development node server.js
*
* on Windows use
* set NODE_ENV=development
* check with
* echo %NODE_ENV%
*/
var env = process.env.NODE_ENV || 'development';
if('development' == env) {
	api.set('view engine', 'ejs');
	api.set('view options', { layout: true });
	api.set('views', __dirname + '/../public');
	api.use(express.favicon());
	api.use(express.logger('dev'));

	// https://github.com/senchalabs/connect/wiki/Connect-3.0
	//api.use(express.bodyParser()); // DEPRECATED
	api.use(bodyParser.urlencoded({
  	extended: true
	})); // NEW IN CONNECT 3.0
	api.use(bodyParser.json()); // NEW IN CONNECT 3.0

	api.use(express.methodOverride());
	api.use(express.cookieParser());
	api.use(device.capture());
	//  api.use(allowCrossDomain);
	api.use(api.router);
	api.use(express.errorHandler({ dumpExceptions: true, showStack: true })); // specific for development
};

/*
* API PRODUCTION
*
* .bash_profile contains
* NODE_ENV=production
*
* or start server as follows
* NODE_ENV=production node server.js
*
* on Windows use
* set NODE_ENV=production
* check with
* echo %NODE_ENV%
*/
var env = process.env.NODE_ENV || 'production';
if('production' == env) {
	api.set('view engine', 'ejs');
	api.set('view options', { layout: true });
	api.set('views', __dirname + '/../public');
	api.use(express.favicon());
	api.use(express.logger('dev'));

	// https://github.com/senchalabs/connect/wiki/Connect-3.0
	//api.use(express.bodyParser()); // DEPRECATED
	api.use(bodyParser.urlencoded({
  	extended: true
	})); // NEW IN CONNECT 3.0
	api.use(bodyParser.json()); // NEW IN CONNECT 3.0

	api.use(express.methodOverride());
	api.use(express.cookieParser());
	api.use(device.capture());
	//  api.use(allowCrossDomain);
	api.use(api.router);
	api.use(express.errorHandler({ dumpExceptions: true, showStack: true })); // specific for production
};

api.all('*', function(req, res, next){
	if (!req.get('Origin')) return next();
	// use "*" here to accept any origin
	res.set('Access-Control-Allow-Origin', '*');  // Accepts requests coming from anyone, replace '*' by configs.allowedHosts to restrict it
	res.set('Access-Control-Allow-Methods', 'GET, PUT, POST');
	res.set('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type');
	// res.set('Access-Control-Allow-Max-Age', 3600);
	if ('OPTIONS' == req.method) return res.send(200);
	next();
});

api.post('/login', function(req, res){
	console.log(req.body);
	res.send(201);
});

/*
* APP DEVELOPMENT
*
* .bash_profile contains
* NODE_ENV=development
*
* or start server as follows
* NODE_ENV=development node server.js
*
* on Windows use
* set NODE_ENV=development
* check with
* echo %NODE_ENV%
*/
var env = process.env.NODE_ENV || 'development';
if('development' == env) {
	//app.set('port', process.env.PORT || 5000);
	app.set('view engine', 'ejs');
	app.set('view options', { layout: true });
	app.set('views', __dirname + '/../public');

	app.use(express.favicon());
	app.use(express.logger('dev'));

	// https://github.com/senchalabs/connect/wiki/Connect-3.0
	//app.use(express.bodyParser()); // DEPRECATED
	app.use(bodyParser.urlencoded({
  	extended: true
	})); // NEW IN CONNECT 3.0
	app.use(bodyParser.json()); // NEW IN CONNECT 3.0
	
	app.use(express.methodOverride());
	app.use(express.cookieParser());
	app.use(device.capture());
	//  app.use(allowCrossDomain);
	app.use(app.router);
	app.use('/resources', express.static(__dirname + '/../public/resources'));
	app.use('/app', express.static(__dirname + '/../public/app'));
	app.use(express.static(__dirname + '/../public')); // Fall back to this as a last resort
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); // specific for development
};



//  MORE... SEE PARKED-server.js



//api.get('/', routes.index);
//api.get('/workouts', workouts.index);
//api.get('/users', user.list);

// services directory
api.get('/services', services.findAll);
api.get('/services/:id', services.findById);
api.post('/services', services.addOne);
api.put('/services/:id', services.updateOne);
api.delete('/services/:id', services.deleteOne);

// the services themselves
// read about access-control-allow-origin here
// http://john.sh/blog/2011/6/30/cross-domain-ajax-expressjs-and-access-control-allow-origin.html
// api.get('/services/mql/read', mqlService.read); // use api.all instead of app.get so as to set the Access-Control-Allow-Origin
api.all('/services/mql/read', mqlService.read);
//api.get('/services/mql/write', mqlService.write);
api.all('/services/mql/write', mqlService.write); // use api.all instead of app.get so as to set the Access-Control-Allow-Origin
//
api.all('/services/test/read', testService.read);
//
api.all('/services/test/write', testService.write);


app.listen(app_port, function () {
	console.log(server_prefix + " - Express app server listening on port %d in %s mode", app_port, app.settings.env);
	// launching as the root user
	// and then downgrading the process permissions
	// to run as another (non-privileged) user
	// after the port is bound
	// for better security
	try {
		process.setgid(app_gid); // Note: this function is only available on POSIX platforms (i.e. not Windows)
		console.log(server_prefix + " - App GID set to " + app_gid);
	}
	catch(ex) {
		console.log(server_prefix + " - App GID not set. Not supported on Windows.");
	}
	try {
		process.setuid(app_uid); // Note: this function is only available on POSIX platforms (i.e. not Windows)
		console.log(server_prefix + " - App UID set to " + app_uid);
	}
	catch(ex) {
		console.log(server_prefix + " - App UID not set. Not supported on Windows.");
	}
});

api.listen(api_port, function () {
	console.log(server_prefix + " - Express api server listening on port %d in %s mode", api_port, api.settings.env);
	// launching as the root user
	// and then downgrading the process permissions
	// to run as another (non-privileged) user
	// after the port is bound
	// for better security
	try {
		process.setgid(api_gid); // Note: this function is only available on POSIX platforms (i.e. not Windows)
		console.log(server_prefix + " - Api GID set to " + api_gid);
	}
	catch(ex) {
		console.log(server_prefix + " - Api GID not set. Not supported on Windows.");
	}
	try {
		process.setuid(api_uid); // Note: this function is only available on POSIX platforms (i.e. not Windows)
		console.log(server_prefix + " - Api UID set to " + api_uid);
	}
	catch(ex) {
		console.log(server_prefix + " - Api UID not set. Not supported on Windows.");
	}
});

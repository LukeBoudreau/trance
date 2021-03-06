//Node Modules
const net = require('net');
//NPM packages
const async = require('async');
//Custom modules
const ClientManager = require('./ClientManager.js');

//ENV Variables
const DEBUG = process.env.DEBUG;
const DPORT = process.env.DPORT;

//Server options

//Create the server
const server = net.createServer( (conn) => {
	console.log('[$] client connected to server');
	ClientManager.emit('addConnection',conn);
});

server.on('error', (err) => {
	console.log('[!] server has crashed!');
	console.log(err);
	throw err;
});

server.listen(DPORT, ()=> {
	console.log('[+] server with following address: ', server.address());
	console.log('[+] server bound');
});

//=============================================================================
// Front End API
var url = require('url');
var express = require('express');
var app = express();
var DatabaseManager = require('./DatabaseManager.js');

app.get('/getAllImages', function(req,res){
	res.writeHead(200, {'Content-Type':'application/json'});
	var records = req.query.records;
	var page = req.query.page;

	DatabaseManager.emit('getAllImages',records,page,function(t){
		msg = { imgNames : [] };
		async.each(t,function(row,pushedImgName){
			msg.imgNames.push(row.filename);
			pushedImgName();
		},function(err){
			res.end(JSON.stringify(msg));
		});
		res.end(JSON.stringify(msg));
	});
});

app.get('/getLastImagePage', function(req,res){
	res.writeHead(200, {'Content-Type':'application/json'});
	var records = req.query.records;

	DatabaseManager.emit('getLastImagePage',records,function(t){
		msg = { lastPage : t };
		res.end(JSON.stringify(msg));
	});
});

app.listen(8080);

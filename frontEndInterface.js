var express = require('express');
var app = express();
var DatabaseManager = require('./DatabaseManager.js');

app.get('/getAllImages', function(req,res){
	res.writeHead(200, {'Content-Type':'application/json'});
	DatabaseManager.emit('getAllImages',10,function(t){
		res.end('hi there');
	});
});

app.listen(8080);

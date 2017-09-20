//Node Modules
const net = require('net');
//NPM packages
//Custom modules
const ClientManager = require('./ClientManager.js');

//ENV Variables
const DEBUG = process.env.DEBUG;
const DPORT = process.env.DPORT;

//Server options

//Create the server
const server = net.createServer( (conn) => {
	// 'conection' listener
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


//Node Modules
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
//NPM packages
//Custom modules
const db = require('./database.js');
const PostNetProcessor = require('./PostNetProcessor.js');

//ENV Variables
const DEBUG = process.env.DEBUG;
const DPORT = process.env.DPORT;
const TEMP_DIR = process.env.TEMP_DIR;
const CONN_LIMIT = 5;

//Server options

//Create the server
var activeConnections = 0;

const server = net.createServer( (conn) => {
	// 'conection' listener
	console.log('[$] client connected to server');
	//Before client begins sending data, send an ack if we have enough connections
	if(activeConnections+1 <= CONN_LIMIT){
		
	}

	var JSONbuf = Buffer.alloc(65536); //65KB of buffer for header
	var totalBytes = 0;
	var headerSize = 0;
	const fileOptions = {
		flags: 'w',
		defaultEncoding: 'binary',
		fd: null,
		mode: 0o666,
		autoClose: true
	};
	const dummyFname = Date.now().toString();
	const fullDummyPath = TEMP_DIR + '/' + dummyFname + '.bin';
	var fileHandle = fs.createWriteStream(fullDummyPath, fileOptions);
	const fileHash = crypto.createHash('sha256');

	conn.on('data', (chunk) => {
		// This is only run once
		// First chunk contains size of header and likely a portion of the metadata
		if( totalBytes == 0) {
			headerSize = chunk.readUInt16BE(0);
			if( chunk.length > 2 ){
				JSONbuf.write( chunk.slice(2,headerSize+2).toString() );
				if( chunk.length > headerSize ){
					//Packet contains binary data in addition to header
					//console.log('[+] Finished receiving header');
					fileHash.update( chunk.slice(headerSize+2,chunk.length) );
					fileHandle.write( chunk.slice(headerSize+2,chunk.length).toString('binary') );
				};
			};
			totalBytes += chunk.length;
			return;
			
		};
	
		if( totalBytes > headerSize ){
			fileHash.update( chunk );
			fileHandle.write( chunk );
		}else if( totalBytes + chunk.length > headerSize ){
			const JSON_end = ( headerSize - totalBytes ) + 2;
			JSONbuf.write( chunk.slice( 0, JSON_end ).toString() );
			fileHash.update( chunk.slice( headerSize+2, chunk.length ) );
			fileHandle.write( chunk.slice( headerSize+2, chunk.length ).toString('binary') );
		} else {
			JSONbuf.write( chunk.toString('binary') );
		};
		totalBytes += chunk.length; //Always get byte length

	});
	
	//End of transaction
	conn.on('end', () => {
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] Finished receiving data');
			console.log("[~] Total bytes: %d", totalBytes);
			console.log('[+] Header Size: %d', headerSize);
			//console.log( fileHash.digest('hex') );
			//var obj = JSON.parse( JSONbuf.slice(0,52) );
			PostNetProcessor.emit('packetArrived', headerSize, JSONbuf.slice(0,headerSize), fullDummyPath, fileHash.digest('hex') );
			fullPackets += 1;
		});
	});

	conn.on('error', (err)=> {
		console.log('[!] Client has killed the connection ...');
		console.log( err );
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] Cleaning up file handle');
		});
	});

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

setInterval(function(){
	console.log('[+] Total Packets services %d', fullPackets);
}, 5000);

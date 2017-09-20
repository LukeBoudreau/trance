//Node Modules
const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
//NPM packages

//Custom Modules
const PostNetProcessor = require('./PostNetProcessor.js');

//ENV Variables
const TEMP_DIR = process.env.TEMP_DIR;
const CONN_LIMIT = 5;

/*
===============================================================================
WARNING!! This is hackiest nodeJS code I've written. 
===============================================================================
*/
class ClientManager extends EventEmitter {};
var clientManager = new ClientManager();

clientManager.connections = [];
clientManager.connectionsProcessing = 0;

clientManager.on('addConnection', function(connection){
	this.connections.push( connection );
	console.log('[+] Connection added to queue');
});

clientManager.on('processConnection', function(){
	conn = this.connections.pop();
	console.log('[+] Processing Connection');
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
	//const fileHash = crypto.createHash('sha256');

	//Send client a ready to receive message
	var ack = Buffer.alloc(2);
	ack.writeUInt16BE( 0 );
	conn.write(ack);

	conn.on('data', (chunk) => {
		// This is only run once
		// First chunk contains size of header and likely a portion of the metadata
		if( totalBytes == 0) {
			headerSize = chunk.readUInt16BE(0);
			if( chunk.length > 2 ){
				JSONbuf.write( chunk.slice(2,headerSize+2).toString() );
				if( chunk.length > headerSize ){
					//Packet contains binary data in addition to header
					//fileHash.update( chunk.slice(headerSize+2,chunk.length) );
					fileHandle.write( chunk.slice(headerSize+2,chunk.length).toString('binary') );
				};
			};
			totalBytes += chunk.length;
			return;
			
		};
	
		if( totalBytes > headerSize ){
			//fileHash.update( chunk );
			fileHandle.write( chunk );
		}else if( totalBytes + chunk.length > headerSize ){
			const JSON_end = ( headerSize - totalBytes ) + 2;
			JSONbuf.write( chunk.slice( 0, JSON_end ).toString() );
			//fileHash.update( chunk.slice( headerSize+2, chunk.length ) );
			fileHandle.write( chunk.slice( headerSize+2, chunk.length ).toString('binary') );
		} else {
			JSONbuf.write( chunk.toString('binary') );
		};
		totalBytes += chunk.length; //Always get byte length

	});
	
	//End of transaction
	conn.on('end', () => {
		this.emit('finishedConnection');
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] Finished receiving data');
			console.log("[~] Total bytes: %d", totalBytes);
			console.log('[+] Header Size: %d', headerSize);
			//console.log( fileHash.digest('hex') );
			//var obj = JSON.parse( JSONbuf.slice(0,52) );
			//PostNetProcessor.emit('packetArrived', headerSize, JSONbuf.slice(0,headerSize), fullDummyPath, fileHash.digest('hex') );
			PostNetProcessor.emit('packetArrived', headerSize, JSONbuf.slice(0,headerSize), fullDummyPath, 0 );
			
		});
	});

	conn.on('error', (err)=> {
		console.log('[!] Client has killed the connection ...');
		console.log( err );
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] Cleaning up file handle');
			this.emit('finishedConnection');
		});
		
	});
});

clientManager.on('finishedConnection', function(){
	this.connectionsProcessing -= 1;
	console.log('[+] Cleaning up connection resources');
});

const checkerFunction = setInterval(function(){
	const queueLength = clientManager.connections.length;
	if(queueLength != 0 && clientManager.connectionsProcessing < CONN_LIMIT){
		clientManager.connectionsProcessing += 1;
		clientManager.emit('processConnection');
	}
	console.log('[+] %d Connections in Queue', queueLength);
	console.log('[+] %d Connections Processing', clientManager.connectionsProcessing);
},1000);

module.exports = clientManager;

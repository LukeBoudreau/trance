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

var getHeaderIndices = function(firstByte,headerSize,headerOffset,chunkLength,totalBytes){
	var indices = {
		start : 0,
		end : 0
	};
	//Calculate start index
	if(firstByte){
		indices.start = headerOffset;
	} else if( totalBytes > (headerSize+headerOffset) ){
		return null;
	} else {
		indices.start = 0;
	}
	//Calculate end index
	var totalBytesArrived = totalBytes + chunkLength;
	if( totalBytesArrived > (headerSize+headerOffset) ){
		// There is some binary data
		const JSON_end = ( headerSize - totalBytes ) + headerOffset;
		indices.end = JSON_end;
	} else if( firstByte && chunkLength == headerOffset){
		return null;
	} else {
		indices.end = chunkLength;
	}
	return indices;
};

clientManager.on('processConnection', function(){
	conn = this.connections.pop();
	console.log('[+] Processing Connection');
	var JSONbuf = Buffer.alloc(1000000); //1MB of buffer for header
	var totalBytes = 0;
	var headerSize = 0;
	var totalHeaderBytes = 0;
	const headerOffset = 4;
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
		//console.log( 'Chunk Size %d', chunk.length );
		// This is only run once
		// First chunk contains size of header and likely a portion of the metadata
		if( totalBytes == 0) {
			headerSize = chunk.readUInt32BE(0);
			i = getHeaderIndices(true,headerSize,headerOffset,chunk.length,totalBytes);
			if(i){
				JSONbuf.write( chunk.slice(i.start,i.end).toString() );
				totalHeaderBytes += (i.end - i.start);
			}
			totalBytes += chunk.length;
			//console.log( i );
			//console.log('Total HeaderBytes %d',totalHeaderBytes);
			return;
			
		};
		
		i = getHeaderIndices(false,headerSize,headerOffset,chunk.length,totalBytes);
		if(!i){
			fileHandle.write( chunk );
		} else if( i.end < chunk.length ) {
			JSONbuf.write( chunk.slice(i.start,i.end).toString(), totalHeaderBytes );
			totalHeaderBytes += (i.end - i.start);
			fileHandle.write( chunk.slice( i.end, chunk.length ).toString('binary') );
		} else {
			JSONbuf.write( chunk.slice(i.start,i.end).toString(), totalHeaderBytes );
			totalHeaderBytes += (i.end - i.start);
		}
		/*
		console.log( i );	
		console.log('Total HeaderBytes %d',totalHeaderBytes);
		console.log('=========');
		*/
		totalBytes += chunk.length; //Always get byte length

	});
	
	//End of transaction
	conn.on('end', () => {
		this.emit('finishedConnection');
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] All Binary data has been flushed...');
			console.log("[~] Total bytes: %d", totalBytes);
			console.log('[+] Header Size: %d', headerSize);
			PostNetProcessor.emit('packetArrived', headerSize, JSONbuf.slice(0,headerSize), fullDummyPath );
		});
			
	});

	conn.on('error', (err)=> {
		this.emit('finishedConnection');
		console.log('[!] Client has killed the connection ...');
		console.log( err );
		fileHandle.end()
		fileHandle.on('finish', ()=> {
			console.log('[+] Cleaning up file handle');
			console.log('[+] Trying to process uploaded content');
			PostNetProcessor.emit('packetArrived', headerSize, JSONbuf.slice(0,headerSize), fullDummyPath );
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
	//console.log('[+] %d Connections in Queue', queueLength);
	//console.log('[+] %d Connections Processing', clientManager.connectionsProcessing);
},1000);

module.exports = clientManager;

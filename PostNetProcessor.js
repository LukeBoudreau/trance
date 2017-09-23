//Node Modules
const crypto = require('crypto');
const fs = require('fs');
const EventEmitter = require('events');
const Path = require('path');
//NPM Packages
const async = require('async');
//Custom Modules
const db = require('./database.js');

//ENV Variables
const STORAGE_IMG_PATH = process.env.STORAGE_IMG_PATH;

class PostNetProcessor extends EventEmitter {};
var postNetProcessor = new PostNetProcessor();
var total = 0;

postNetProcessor.on('packetArrived', function(headerSize,packetHeader,fullDummyPath) {
	console.log('[+] Data Packet has arrived in Full');
	var metadataObj = JSON.parse(packetHeader);
	//Add data to obj pointer as server data
	metadataObj.serverData = {};
	console.log( metadataObj );
	total += metadataObj.images.length;
	// Move and rename all files
	
	/*
	fs.rename( fullDummyPath, STORAGE_IMG_PATH + '/' +  metadataObj.name, ()=> {
		console.log('[+] Renamed File');
		db.addImage( metadataObj, () => {
			console.log('[+] Record Created in Database');
		});
	});
	*/
	const writeFileOptions = {
		flags: 'w',
		defaultEncoding: 'binary',
		fd: null,
		mode: 0o666,
		autoClose: true
	};
	metadataObj.serverData.binaryStart = 0;
	async.eachSeries(metadataObj.images,function(metadata,filerenamed){
		// Cut up the binary file
		const readFileOptions = {
			flags: 'r',
			defaultEncoding: 'binary',
			fd: null,
			mode: 0o666,
			autoClose: true,
			start: metadataObj.serverData.binaryStart,
			end: metadataObj.serverData.binaryStart + metadata.size
		};
		//console.log(' start: %d, end %d', readFileOptions.start, readFileOptions.end );
		const rpipe = fs.createReadStream(fullDummyPath,readFileOptions);
		const wpipe = fs.createWriteStream(STORAGE_IMG_PATH + '/' +  metadata.name,writeFileOptions);

		//pipe to write stream
		rpipe.pipe(wpipe);
		wpipe.on('finish', ()=>{
			metadataObj.serverData.binaryStart += metadata.size;
			filerenamed();
		});

	}, function(err){
		console.log('[+] Moved/renamed all files');
		fs.unlink(fullDummyPath,function(err){
			console.log('[+] Removed dummy File');
		});
		
	});
	
});

const c = setInterval(function(){
	console.log('[+] %d total files uploaded', total);
},2000);

module.exports = postNetProcessor;


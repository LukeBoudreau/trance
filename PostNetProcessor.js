//Node Modules
const crypto = require('crypto');
const fs = require('fs');
const EventEmitter = require('events');
const Path = require('path');
//NPM Packages
const async = require('async');
const sharp = require('sharp');
//Custom Modules
const DatabaseManager = require('./DatabaseManager.js');

//ENV Variables
const STORAGE_IMG_PATH = process.env.STORAGE_IMG_PATH;

class PostNetProcessor extends EventEmitter {};
var postNetProcessor = new PostNetProcessor();
var total = 0;

postNetProcessor.on('packetArrived', function(headerSize,packetHeader,fullDummyPath) {
	console.log('[+] Data Packet has arrived');
	if( packetHeader.length != headerSize ){
		console.log('[!] Header not received in full, discarding everything');
		return;
	}
	// Try to parse the header
	var metadataObj = {};
	try {
		 metadataObj = JSON.parse(packetHeader);
	} catch (err) {
		console.log('[!] Couldn\'t parse header, removing binary file...');
		fs.unlink(fullDummyPath,function(err){
			console.log('[+] Removed dummy File');
		});
		return;
	}
	//Add data to obj pointer as server data
	metadataObj.serverData = {};
	//console.log( metadataObj );
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
	// Get file size of binary file
	const binaryFileSize = fs.statSync(fullDummyPath).size;
	// True files received
	var imagesReceived = [];
	async.eachSeries(metadataObj.images,function(metadata,filerenamed){
		const fileEnd = metadataObj.serverData.binaryStart + metadata.size;
		if( fileEnd >  binaryFileSize ){
			// Stream was cut off while uploading a portion of the binary content.
			filerenamed();	
		} else {
			// Cut up the binary file
			const readFileOptions = {
				flags: 'r',
				defaultEncoding: 'binary',
				fd: null,
				mode: 0o666,
				autoClose: true,
				start: metadataObj.serverData.binaryStart,
				end: fileEnd
			};
			//console.log(' start: %d, end %d', readFileOptions.start, readFileOptions.end );
			const rpipe = fs.createReadStream(fullDummyPath,readFileOptions);
			const imageFname = STORAGE_IMG_PATH + '/' + metadata.name;
			const wpipe = fs.createWriteStream(imageFname,writeFileOptions);

			//pipe to write stream
			rpipe.pipe(wpipe);
			wpipe.on('finish', ()=>{
				metadataObj.serverData.binaryStart += metadata.size;
				imagesReceived.push(metadata);
				//Create thumbnail for image
				const thumbnail_wpipe = fs.createWriteStream( imageFname.slice(0,-4) + '-tmb.jpg');
				sharp(imageFname).resize(300,200).pipe(thumbnail_wpipe);
				filerenamed();
			});
		}

	}, function(err){
		console.log('[+] Moved/renamed all files');
		fs.unlink(fullDummyPath,function(err){
			console.log('[+] Removed dummy File');
		});
		metadataObj.serverData.imagesReceived = imagesReceived;
		console.log('[+] %d/%d images received',imagesReceived.length,metadataObj.images.length);
		total += imagesReceived.length;
		DatabaseManager.emit('insertImages', metadataObj.serverData.imagesReceived, function(){
			console.log('[+] images inserted into database');
		});
	});
	
});

const c = setInterval(function(){
	console.log('[+] %d total files uploaded', total);
},2000);

module.exports = postNetProcessor;


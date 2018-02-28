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
const ImageProcessor = require('./ImageProcessor.js');

//ENV Variables
const STORAGE_IMG_PATH = process.env.STORAGE_IMG_PATH;

class PostNetProcessor extends EventEmitter {};
var postNetProcessor = new PostNetProcessor();
//var total = 0;

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
	//console.log( Object.keys(metadataObj.images[0]) );
	
	const writeFileOptions = {
		flags: 'w',
		defaultEncoding: 'binary',
		fd: null,
		mode: 0o666,
		autoClose: true
	};
	// Initialize the pointer to the file start byte to the beginning of the binary blob
	metadataObj.serverData.binaryStart = 0;
	// Get file size of binary file
	const binaryFileSize = fs.statSync(fullDummyPath).size;
	// True files received
	var imagesReceived = [];
	console.log('[+] Cutting up binary file into images...');
	// async.eachSeries is important b/c the ordering of images in the header corresponds with
	// each file location in the binary blob. You must traverse the header in order.
	async.eachSeries(metadataObj.images,function(metadata,filerenamed){
		const fileEnd = metadataObj.serverData.binaryStart + metadata.size;
		if( fileEnd >  binaryFileSize ){
			// Stream was cut off while uploading a portion of the binary blob
			filerenamed();	
		} else {
			// Cut each real file from the binary blob file
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

			//Write a portion of the binary to disk as an image file.
			rpipe.pipe(wpipe);
			wpipe.on('finish', ()=>{
				metadataObj.serverData.binaryStart += metadata.size;
				imagesReceived.push(metadata);
				//Create thumbnail for image
				//const thumbnail_wpipe = fs.createWriteStream( imageFname.slice(0,-4) + '-tmb.jpg');
				//sharp(imageFname).resize(300,200).pipe(thumbnail_wpipe);
				filerenamed();
			});
		}

	}, function(err){
		console.log('[+] Moved/renamed all files');
		//Remove the concatenated Binary from disk
		fs.unlink(fullDummyPath,function(err){
			console.log('[+] Removed dummy File');
		});
		//Create thumbnails for all images
		console.log('[+] Creating all thumbnails...');
		//Gather all filenames that were received by the server
		async.map(imagesReceived,function(item,mapCallback){
			const imageFname = STORAGE_IMG_PATH + '/' + item.name;
			mapCallback(null,imageFname);
		},function(err,results){
			//console.log(err);
			//console.log(results);
			async.each(results,function(filePath,tmbCallback){
				const thumbnail_wpipe = fs.createWriteStream( filePath.slice(0,-4) + '-tmb.jpg');
				sharp(filePath).resize(300,200).pipe(thumbnail_wpipe);
			}, function(err) {
				console.log('[+] Finished creating %d thumbnails',imagesReceived.length);
			});
			
		});

		metadataObj.serverData.imagesReceived = imagesReceived;
		console.log('[+] %d/%d images received',imagesReceived.length,metadataObj.images.length);
		//total += imagesReceived.length;
		DatabaseManager.emit('insertImages', metadataObj.serverData.imagesReceived, function(){
			console.log('[+] images inserted into database');
		});
	});
	
});

/*
const c = setInterval(function(){
	console.log('[+] %d total files uploaded', total);
},2000);
*/

module.exports = postNetProcessor;


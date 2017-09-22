//Node Modules
const crypto = require('crypto');
const fs = require('fs');
const EventEmitter = require('events');
const Path = require('path');
//NPM Packages
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
	//console.log( metadataObj );
	total += 1;
	/*
	fs.rename( fullDummyPath, STORAGE_IMG_PATH + '/' +  metadataObj.name, ()=> {
		console.log('[+] Renamed File');
		db.addImage( metadataObj, () => {
			console.log('[+] Record Created in Database');
		});
	});
	*/
	
});

const c = setInterval(function(){
	console.log('[+] %d total files uploaded', total);
},2000);

module.exports = postNetProcessor;


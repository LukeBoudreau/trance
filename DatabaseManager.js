//Node Modules
const Path = require('path');
const EventEmitter = require('events');
//npm Modules
const { Pool, Client } = require('pg');
const async = require('async');
//Custom modules
console.log("[+] Setting up connection to database");

//ENV variables
const DEBUG = process.env.DEBUG;
const STORAGE_IMG_PATH = process.env.STORAGE_IMG_PATH;
const pool = new Pool();

class DatabaseManager extends EventEmitter {};
var databaseManager = new DatabaseManager();

databaseManager.on('insertImages', function(imageMetadata,imagesInsertedCallback) {
	async.each(imageMetadata,function(metadataObj,insertedImageCallback){
		const created = new Date(metadataObj.created);
		//Construct Query
		const query = {
			text: 'INSERT INTO pictures(name,filename,hash,record_creation,created,desktop_experience,file_location) VALUES ($1,$2,$3,now(),$4,false,$5)',
			values: [Path.basename(metadataObj.name,metadataObj.type),metadataObj.name,0,created,STORAGE_IMG_PATH]	
		};
		pool.query(query.text,query.values,(err,res) => {
			if (err) {
				throw err;
			}
			insertedImageCallback();
		});
	}, function(err) {
		imagesInsertedCallback();
	});
});

databaseManager.on('getAllImages', function(totalRecords,imagesRetrieved){
	pool.query('SELECT filename FROM pictures',(err,res) => {
		if (err) {
			throw err;
		}
		imagesRetrieved(res.rows);
	});
});
/*
pool.query('SELECT NOW() as now', (err,res) => {
	console.log(res.rows[0]);
	pool.end();
});
*/

module.exports = databaseManager;

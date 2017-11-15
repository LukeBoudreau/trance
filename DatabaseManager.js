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

databaseManager.on('getAllImages', function(recordsPerPage,page,imagesRetrieved){
	//Calculate the offset value
	var pageMultipler = page-1;
	if ( pageMultipler < 0 ){
		pageMultipler = 0;
	}
	//TODO: TYPE & Value CHECKING on recordsPerPage!!
	var offset = pageMultipler*recordsPerPage;
	//Get Total Count
	var totalRecords = -1;
	pool.query('SELECT count(*) FROM pictures',(err,res) => {
		totalRecords = res.rows[0].count;
		//Check edge case (Records passed the edge)
		if (offset > totalRecords){
			//offset = totalRecords-recordsPerPage;
			// Manually Calculate the last page cause client is an idiot
			//TODO: TYPE & Value CHECKING on recordsPerPage!!
			var lastPage = parseInt(totalRecords / recordsPerPage);
			if( totalRecords % recordsPerPage !== 0 ){
				lastPage += 1;
			}
			offset = (lastPage-1)*recordsPerPage;
		}
		//Query the records
		const query = {
			text: 'SELECT filename FROM pictures ORDER BY created DESC LIMIT $1 OFFSET $2',
			values: [recordsPerPage,offset]
		};
		pool.query(query.text,query.values,(err,res) => {
			if (err) {
				throw err;
			}
			imagesRetrieved(res.rows);
		});
	});
});
/*
pool.query('SELECT NOW() as now', (err,res) => {
	console.log(res.rows[0]);
	pool.end();
});
*/

module.exports = databaseManager;

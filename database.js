//Node Modules
const Path = require('path');
//npm Modules
const { Pool, Client } = require('pg');
//Custom modules
console.log("[+] Setting up connection to database");

//ENV variables
const DEBUG = process.env.DEBUG;
const STORAGE_IMG_PATH = process.env.STORAGE_IMG_PATH;
const pool = new Pool();

exports.query = function(q,data) {
	console.log("[+] Creating & executing query");
};

exports.addImage = function(metadata,callback) {
	console.log("[+] Adding record for image to database");
	const created = new Date(metadata.created);
	//Construct Query
	const query = {
		text: 'INSERT INTO pictures(name,filename,hash,record_creation,created,desktop_experience,file_location) VALUES ($1,$2,$3,now(),$4,false,$5)',
		values: [Path.basename(metadata.name,metadata.type),metadata.name,metadata.serverData.fileHash,created,STORAGE_IMG_PATH]	
	};
	pool.query(query.text,query.values,(err,res) => {
		if (err) {
			throw err;
		}
		callback();
	});
};

/*
pool.query('SELECT NOW() as now', (err,res) => {
	console.log(res.rows[0]);
	pool.end();
});
*/


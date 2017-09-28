--CREATE USER luke with PASSWORD 'vrdb89';
--CREATE DATABASE est;
--Create Picture tables
DROP TABLE IF EXISTS pictures;
CREATE TABLE pictures (name varchar(160), file_location text, filename varchar, hash varchar, record_creation timestamp with time zone, description text, created timestamp with time zone, desktop_experience boolean, album_art boolean, thumbnail_location text);

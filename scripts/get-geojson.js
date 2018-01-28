const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const fileName = "countries.geo.json";
const settings = require("./get-settings");

function getGeoJSON (callback) {
    if (settings.s3) {
        const s3 = new AWS.S3({
            region: settings.awsRegion
        });
    
        s3.getObject({
            Bucket: settings.distBucket,
            Key: fileName
        },
        (error, data) => {
            if (error) {
                return callback(console.error(`Could not get GeoJSON from S3 due to ${error.name}:${error.message}`));
            }

            try {
                callback(JSON.parse(data));
            }
            catch (e) {
                callback(console.error(`Could not parse GeoJSON from S3 due to ${e.name}:${e.message}`));
            }
        });
    }
    else {
        callback(geoJSONFromFile());
    }
}

function geoJSONFromFile () {
    try {
        return JSON.parse(fs.readFileSync(path.join(settings.distDir, fileName)));
    }
    catch (e) {
        return JSON.parse(fs.readFileSync(path.join("../src", fileName)));
    }
}

module.exports = getGeoJSON;
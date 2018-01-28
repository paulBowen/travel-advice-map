const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const settings = require("./get-settings");

const cloudFront = new AWS.CloudFront();
const uploadedItems = [];
const promises = [];
const s3 = new AWS.S3({
    region: settings.awsRegion || "ap-southeast-2"
});

const contentTypes = {
    ".css": "text/css",
    ".gif": "image/gif",
    ".html": "text/html",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".txt": "text"
};

function updateS3 (source, dest, callback) {
    if (!settings.s3) {
        return;
    }

    const stream = fs.createReadStream(source);
    stream.on("error", error => console.error(`${source} could not be read for S3 due to ${error.name}:${error.message}`));

    promises.push(new Promise (
        resolve => {
            s3.upload({
                Bucket: settings.distBucket,
                Key: dest,
                Body: stream,
                ContentType: contentTypes[path.extname(source)] || contentTypes[".txt"]
            },
            error => {
                if (error) {
                    console.error(`${dest} not uploaded to S3 due to ${error.name}:${error.message}`);
                    resolve();
                    if (callback) {
                        callback();
                    }
                    return;
                }

                // Cloudfront invalidation requires leading slash
                uploadedItems.push("/" + dest);
                resolve();
                if (callback) {
                    callback();
                }
            });
        }
    ));
}

function updateCDN () {
    if (!settings.cdn) {
        return;
    }

    Promise.all(promises)
        .then(() => {
            settings.cdnDists.forEach(cdnDist => {
                cloudFront.createInvalidation({
                    DistributionId: cdnDist,
                    InvalidationBatch: {
                        // CallerReference string just needs to be unique to our dist
                        // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createInvalidation-property
                        CallerReference: Date.now().toString(),
                        Paths: {
                            Quantity: uploadedItems.length,
                            Items: uploadedItems
                        }
                    }
                },
                error => {
                    if (error) {
                        console.error(`${cdnDist} not issued invalidation due to ${error.name}:${error.message}`);
                    }
                });
            });
        })
        .catch(e => console.error(e.message));
}

exports.CDN = updateCDN;
exports.S3 = updateS3;
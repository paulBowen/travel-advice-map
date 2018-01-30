const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");

const settings = require("./get-settings");

const cloudFront = new AWS.CloudFront();
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
    stream.on("error", error => callback(console.error(`${source} could not be read for S3 due to ${error.name}:${error.message}`)));

    s3.upload({
        Bucket: settings.distBucket,
        Key: dest,
        Body: stream,
        ContentType: contentTypes[path.extname(source)] || contentTypes[".txt"]
    },
    (error, data) => {
        if (error) {
            console.error(`${dest} not uploaded to S3 due to ${error.name}:${error.message}`);
            if (callback) {
                callback();
            }
            return;
        }

        if (callback) {
            callback(data.Key);
        }
    });
}

function updateCDN (paths) {
    if (!settings.cdn) {
        return;
    }

    for (let i = paths.length - 1; i >= 0; i--) {
        if (!paths[i]) {
            paths.splice(i, 1);
            continue;
        }

        // Cloudfront invalidation requires leading slash
        paths[i] = "/" + paths[i];
    }

    settings.cdnDists.forEach(cdnDist => {
        cloudFront.createInvalidation({
            DistributionId: cdnDist,
            InvalidationBatch: {
                // CallerReference string just needs to be unique to our dist
                // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#createInvalidation-property
                CallerReference: Date.now().toString(),
                Paths: {
                    Quantity: paths.length,
                    Items: paths
                }
            }
        },
        error => {
            if (error) {
                console.error(`${cdnDist} not issued invalidation due to ${error.name}:${error.message}`);
            }
        });
    });
}

exports.CDN = updateCDN;
exports.S3 = updateS3;
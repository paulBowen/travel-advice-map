const csso = require("csso");
const fs = require("fs");
const path = require("path");
const uglifyJS = require("uglify-js");

const settings = require("./get-settings");
const updateAWS = require("./update-aws");

function updateCode () {
    const promises = [];
    const assetsDir = path.join(__dirname, "..", "assets");
    const srcDir = path.join(__dirname, "..", "src");

    // No leading slash, as these may be used as S3 object keys
    const assets = [
        "css/leaflet.css",
        "css/normalize.css",
        "favicon.png",
        "js/leaflet.js",
        "js/leaflet-pattern.js",
        "robots.txt"
    ];

    assets.forEach(asset => promises.push(copyFile(assetsDir, asset)));

    promises.push(copyFile(srcDir, "index.html"));

    promises.push(minify(srcDir, "css/main.css", true));

    promises.push(minify(srcDir, "js/format-map.js"));

    Promise.all(promises)
        .then(values => {
            if (settings.AWS) {
                updateAWS.CDN(values);
            }
        })
        .catch(e => console.error(e.message));
}

function copyFile (sourceDir, fileName) {
    return new Promise(resolve => {
        fs.copyFile(path.join(sourceDir, fileName), path.join(settings.distDir, fileName), error => {
            if (error) {
                return resolve(console.error(`${fileName} could not be copied due to ${error.name}:${error.message}`));
            }

            if (settings.s3) {
                updateAWS.S3(path.join(settings.distDir, fileName), fileName, resolve);
            }
            else {
                resolve();
            }
        });
    });
}

function minify (sourceDir, fileName, isCSS) {
    return new Promise(resolve => {
        fs.readFile(path.join(sourceDir, fileName), "utf8", (error, data) => {
            if (error) {
                return resolve(console.error(`${fileName} could not be read due to ${error.name}:${error.message}`));
            }

            let minified = "";
            if (isCSS) {
                minified = (csso.minify(data)).css;
            }
            else {
                minified = (uglifyJS.minify(data, {
                    mangle: false
                })).code;
            }

            fs.writeFile(path.join(settings.distDir, fileName), minified, error => {
                if (error) {
                    return resolve(console.error(`${fileName} could not be written due to ${error.name}:${error.message}`));
                }

                if (settings.s3) {
                    updateAWS.S3(path.join(settings.distDir, fileName), fileName, resolve);
                }
                else {
                    resolve();
                }
            });
        });
    });
}

module.exports = updateCode;
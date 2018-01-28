const fs = require("fs");
const path = require("path");

try {
    var settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));
}
catch (e) {
    throw new Error(`Settings file could not be parsed due to ${e.name}:${e.message}`);
}

settings.s3 = Boolean(settings.distBucket && settings.awsRegion);
settings.cdn = Boolean(settings.s3 && Array.isArray(settings.cdnDists) && (settings.cdnDists.length > 0));

if (!settings.baseURL) {
    throw new Error("No base URL specified in settings file");
}

if (!settings.distDir) {
    throw new Error("No distribution directory specified in settings file");
}

try {
    createDir(path.normalize(settings.distDir));
    createDir(path.join(settings.distDir, "/countries"));
    createDir(path.join(settings.distDir, "/css"));
    createDir(path.join(settings.distDir, "/js"));
}
catch (e) {
    throw new Error(`Distribution directory could not be created due to ${e.name}:${e.message}`);
}

function createDir (dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
    }
}

module.exports = settings;
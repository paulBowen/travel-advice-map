const fs = require("fs");
const request = require("request");
const { URL } = require("url");

const settings = require("./get-settings");
const updateCode = require("./update-code");
const updateContent = require("./update-content");

const countriesURL = new URL("/countries", settings.baseURL);

request(countriesURL.toString(), (error, response, body) => {
    if (error || response.statusCode !== 200) {
        throw new Error(`Could not access ${countriesURL.toString()}`);
    }

    try {
        var countries = JSON.parse(body);
    }
    catch (e) {
        throw new Error(`Country list could not be parsed from API due to ${e.name}:${e.message}`);
    }

    const requiredCountries = filterCountries(countries);

    if (!requiredCountries) {
        return;
    }
    
    updateCode();
    updateContent(requiredCountries);
});

function filterCountries (countries) {
    if (!Array.isArray(countries) || countries.length < 150) {
        return console.error("API country list was incomplete");
    }

    if (!Array.isArray(settings.countries) || settings.countries.length < 150) {
        settings.countries = countries.map(x => ({ normalizedTitle: x.NormalizedTitle, lastModified: x.LastModified }));
        fs.writeFile("./settings.json", JSON.stringify(settings, null, 2), error => {
            if (error) {
                console.error(`Settings file could not be written due to ${error.name}:${error.message}`);
            }
        });

        return countries;
    }

    settings.newCountries = countries.map(x => ({ normalizedTitle: x.NormalizedTitle, lastModified: x.LastModified }));

    for (let i = countries.length - 1; i >= 0; i--) {
        const cachedCountry = settings.countries.find(x => x.normalizedTitle === countries[i].NormalizedTitle);

        if (!cachedCountry) {
            continue;
        }
        else if (Date.parse(countries[i].LastModified) > Date.parse(cachedCountry.lastModified)) {
            continue;
        }
        else {
            countries.splice(i, 1);
        }
    }

    settings.countries = settings.newCountries;
    delete settings.newCountries;
    fs.writeFile("./settings.json", JSON.stringify(settings, null, 2), error => {
        if (error) {
            console.error(`Settings file could not be written due to ${error.name}:${error.message}`);
        }
    });

    if (countries.length > 0) {
        return countries;
    }
}
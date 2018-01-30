const fs = require("fs");
const path = require("path");
const request = require("request");
const { URL } = require("url");

const adviceLevels = require("./advice-levels");
const getGeoJSON = require("./get-geojson");
const settings = require("./get-settings");
const updateAWS = require("./update-aws");

const countriesURL = new URL("/countries/", settings.baseURL);

function updateContent (requiredCountries) {
    getGeoJSON(geoJSON => {
        if (!geoJSON
        || !Array.isArray(geoJSON.features)
        || geoJSON.features.length < 150
        || !geoJSON.features[0].properties
        || !geoJSON.features[0].properties.name) {
            return console.error("GeoJSON was invalid");
        }

        updateCountries(requiredCountries, geoJSON);
    });
}

function updateCountries (requiredCountries, geoJSON) {
    const promises = [];

    for (let i = geoJSON.features.length - 1; i >= 0; i--) {
        const requiredCountry = requiredCountries.find(x => x.Title === geoJSON.features[i].properties.name);

        if (!requiredCountry) {
            continue;
        }

        promises.push(updateCountry(requiredCountry, geoJSON.features[i]));
    }

    // Need to wait for all features to be updated before writing out GeoJSON containing those features!
    Promise.all(promises)
        .then(values => {
            const fileName = "countries.geo.json";

            fs.writeFile(path.join(settings.distDir, fileName), JSON.stringify(geoJSON), error => {
                if (error) {
                    return console.error(`${fileName} could not be written due to ${error.name}:${error.message}`);
                }

                if (settings.s3) {
                    updateAWS.S3(path.join(settings.distDir, fileName), fileName, value => {
                        values.push(value);
                        updateAWS.CDN(values);
                    });
                }
            });
        })
        .catch(e => console.error(e.message));
}

function updateCountry (requiredCountry, feature) {
    return new Promise(resolve => {
        request((new URL(requiredCountry.NormalizedTitle, countriesURL)).toString(), (error, response, body) => {
            if (error || response.statusCode !== 200) {
                return resolve(console.error(`Data for ${requiredCountry.NormalizedTitle} not loaded`));
            }
        
            try {
                var country = JSON.parse(body);
            }
            catch (e) {
                return resolve(console.error(`Data for ${requiredCountry.NormalizedTitle} not parsed due to ${e.name}:${e.message}`));
            }

            updateFeature(feature, country);

            if (country.AdviceIssued && country.Advice.length > 0) {
                const promises = [];
                promises.push(updateMarkup(feature, country));
                promises.push(updateImage(feature, country));

                Promise.all(promises)
                    .then(() => resolve())
                    .catch(e => resolve(console.error(e.message)));
            }
            else {
                resolve();
            }
        });
    });
}

function updateFeature (feature, country) {
    if (!country.AdviceIssued || country.Advice.length < 1) {
        delete feature.properties.secondaryColor;
        delete feature.properties.color;
        return;
    }

    // country.Advice[0] is always the 'overall' advice for the country
    const adviceLevel = adviceLevels[country.Advice[0].level] || adviceLevels.none;
    feature.properties.color = adviceLevel.color;

    // If there is more in country.Advice, find the most dangerous level of those
    if (country.Advice.length > 1) {
        if (country.Advice.find(x => x.level === "danger")) {
            feature.properties.secondaryColor = adviceLevels.danger.color;
        }
        else if (country.Advice.find(x => x.level === "warning")) {
            feature.properties.secondaryColor = adviceLevels.warning.color;
        }
        else if (country.Advice.find(x => x.level === "caution")) {
            feature.properties.secondaryColor = adviceLevels.caution.color;
        }
        else if (country.Advice.find(x => x.level === "normal")) {
            feature.properties.secondaryColor = adviceLevels.normal.color;
        }
        else {
            feature.properties.secondaryColor = adviceLevels.none.color;
        }
    }
}

function updateMarkup (feature, country) {
    return new Promise(resolve => {
        const countryCode = feature.properties.id;

        let html =
        `<div class="country-title">
            <div class="country-emoji-placeholder">`;

        const emojiMarkup = getEmojiMarkup(countryCode);
        if (emojiMarkup) {
            html = html + emojiMarkup;
        }

        html = html +
            `</div>
            <h1>${country.Title}</h1>
        </div>
        <div class="country-details-container">
            <div class="country-map-container">
                <div class="country-map-placeholder">
                    <a class="country-map" href="/countries/${countryCode}.gif" target="_blank">
                        <img src="/countries/${countryCode}.gif" />
                    </a>
                </div>
            </div>
            <div class="country-advice-container">
                <div class="advice-accordion">`;

        country.Advice.forEach((advice, i) => {
            const adviceLevel = adviceLevels[advice.level] || adviceLevels.none;

            html = html +
                `<div>
                    <input id="${countryCode}-${i}" name="accordion-radio" type="radio" ${i === 0 ? "checked" : ""}/>
                    <label for="${countryCode}-${i}" class="advice-label ${adviceLevel.css}">${advice.text} — ${adviceLevel.shortText}
                        <span class="advice-chevron-down">
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="14" height="14" viewBox="0 0 14 14">
                                <path class="${adviceLevel.css}" d="M13.148 6.312l-5.797 5.789q-0.148 0.148-0.352 0.148t-0.352-0.148l-5.797-5.789q-0.148-0.148-0.148-0.355t0.148-0.355l1.297-1.289q0.148-0.148 0.352-0.148t0.352 0.148l4.148 4.148 4.148-4.148q0.148-0.148 0.352-0.148t0.352 0.148l1.297 1.289q0.148 0.148 0.148 0.355t-0.148 0.355z"></path>
                            </svg>
                        </span>
                    </label>
                    <p class="advice-text">${adviceLevel.longText}</p>
                </div>`;
        });

        const lastModifiedString = (new Date(country.LastModified)).toLocaleDateString("en-AU", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        html = html +
        `       </div>
                <p><strong>Latest Australian Government advice — issued ${lastModifiedString}</strong>
                    <br />
                    ${country.Summary}
                    <br />
                    <br />
                    <a href="${country.URL}" target="_blank">Read more from the Department of Foreign Affairs and Trade (opens in a new tab)
                </p>
            </div>
        </div>`;
        
        const fileName = `countries/${countryCode}.html`;
        fs.writeFile(path.join(settings.distDir, fileName), html, error => {
            if (error) {
                return resolve(console.error(`Markup for ${country.Title} not written due to ${error.name}:${error.message}`));
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

function getEmojiMarkup (countryCode) {
    // From Wikipedia https://en.wikipedia.org/wiki/Regional_Indicator_Symbol
    // A pair of regional indicator symbols produces an emoji flag sequence

    // countryCode should be in ISO 3166-1 alpha-2 format
    // to be able to convert to regional indicator symbols
    if (!countryCode || countryCode.length !== 2) {
        return;
    }

    // There is a fixed offset between each uppercase ASCII code point
    // and the corresponding regional indicator code point
    const offset = 127397;
    const firstRegionalCodePoint = countryCode.charCodeAt(0) + offset;
    const lastRegionalCodePoint = countryCode.charCodeAt(1) + offset;

    // There are 26 regional indicator code points
    // starting at U+1F1E6 (127462 in decimal)
    const lowerBound = 127462;
    const upperBound = 127487;
    if (firstRegionalCodePoint < lowerBound || firstRegionalCodePoint > upperBound) {
        return;
    }
    if (lastRegionalCodePoint < lowerBound || lastRegionalCodePoint > upperBound) {
        return;
    }

    // Convert code points to hex to match Twitter emoji CDN's filename
    const fileName = `${firstRegionalCodePoint.toString(16)}-${lastRegionalCodePoint.toString(16)}.png`;
    return `<img src="https://twemoji.maxcdn.com/2/72x72/${fileName}"/>`;
}

function updateImage (feature, country) {
    return new Promise(resolve => {
        const fileName = `countries/${feature.properties.id}.gif`;

        const stream = fs.createWriteStream(path.join(settings.distDir, fileName));
        stream.on("error", error => resolve(console.error(`Image for ${country.Title} not written due to ${error.name}:${error.message}`)));
        stream.on("close", () => {
            if (settings.s3) {
                updateAWS.S3(path.join(settings.distDir, fileName), fileName, resolve);
            }
            else {
                resolve();
            }
        });

        request
            .get((new URL(country.NormalizedTitle + "/map", countriesURL)).toString())
            .on("error", () => resolve(console.error(`Image for ${country.Title} not loaded`)))
            .pipe(stream);
    });
}

module.exports = updateContent;
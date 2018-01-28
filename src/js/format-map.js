var geoJSON;

var map = L.map('map', {
    center: [14, 48],
    zoom: 3,
    scrollWheelZoom: false,
    attributionControl: false
});

var legendControl = L.control({
    position: 'topleft'
});
legendControl.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'country-legend');
    this._div.innerHTML = '<span><strong>Travel Advice Map</strong></span><br />' +
    '<span>Click a country to view advice</span><br />' +
    '<span><strong>Legend</strong></span><br />' +
    '<i class="advice-color-normal"></i>' +
    '<span>Exercise normal safety precautions</span><br />' +
    '<i class="advice-color-caution"></i>' +
    '<span>Exercise a high degree of caution</span><br />' +
    '<i class="advice-color-warning"></i>' +
    '<span>Reconsider your need to travel</span><br />' +
    '<i class="advice-color-danger"></i>' +
    '<span>Do not travel</span><br />' +
    '<i class="advice-color-none"></i>' +
    '<span>No advice issued</span><br />' +
    '<span><a href="https://github.com/paulBowen/travel-advice-map" target="_blank">About...</span>';
    return this._div;
};
legendControl.addTo(map);

var infoControl = L.control({
    position: 'bottomright'
});
infoControl.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'country-info');
    // Make scrolling work on desktop and touch
    if (!L.Browser.touch) {
        L.DomEvent
            .disableClickPropagation(this._div)
            .disableScrollPropagation(this._div);
    }
    else {
        L.DomEvent.disableClickPropagation(this._div);
    }
    return this._div;
};

var closeControl = L.control({
    position: 'bottomright'
});
closeControl.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'country-close');
    this._div.innerHTML = '<input id="country-close-button" type="button" value="X" onclick="hideInfoControl();" />';
    return this._div;
};

function hideInfoControl() {
    var closeElement = document.querySelector('.country-close');
    if (closeElement) {
        closeElement.style.display = 'none';
    }

    var infoElement = document.querySelector('.country-info');
    if (infoElement) {
        infoElement.style.display = 'none';
    }
}

function onMouseover (event) {
    event.target.setStyle({
        color: '#000',
        weight: 2,
        fillOpacity: 1
    });
}

function onMouseout (event) {
    event.target.setStyle({
        color : '#666',
        weight: 1,
        fillOpacity: 0.9
    });
}

map.on('click', function(event) {
    hideInfoControl();
});

function onClick (event) {
    // Stop click being handled by other parts of Leaflet
    L.DomEvent.stopPropagation(event);

    var request = new XMLHttpRequest();
    request.open('GET', '/countries/' + event.target.feature.properties.id + '.html', true);

    request.onload = function() {
        if (request.status === 200) {
            var infoElement = document.querySelector('.country-info');
            if (infoElement) {
                infoControl._div.innerHTML = request.responseText;
                infoElement.style.display = 'block';
            }
            else {
                infoControl.addTo(map);
                infoControl._div.innerHTML = request.responseText;
            }

            var closeElement = document.querySelector('.country-close');
            if (closeElement) {
                closeElement.style.display = 'block';
            }
            else {
                closeControl.addTo(map);
            }
        }
    };

    request.send();
}

function createStripes (feature) {
    var stripes = new L.StripePattern({
        color: feature.properties.color,
        spaceColor: feature.properties.secondaryColor,
        opacity: 1,
        spaceOpacity: 1,
        weight: 6,
        spaceWeight: 2
    });

    stripes.addTo(map);

    return stripes;
}

function style (feature) {
    if (feature.properties.secondaryColor) {
        var stripes = createStripes(feature);
        
        return {
            fillPattern: stripes
        };
    }
    else {
        return {
            fillColor: feature.properties.color || '#708090'
        };
    }
}

function onEachFeature (feature, layer) {
    layer.setStyle({
        color : '#666',
        weight: 1,
        fillOpacity: 0.9
    });

    if (!feature.properties.color || feature.properties.color === '#708090') {
        return;
    }

    layer.on({
        mouseover: onMouseover,
        mouseout: onMouseout,
        click: onClick
    });
}

var request = new XMLHttpRequest();
request.open('GET', '/countries.geo.json', true);

request.onload = function() {
    if (request.status === 200) {
        geoJSON = L.geoJson(JSON.parse(request.response), {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);
    }
};

request.send();
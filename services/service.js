require('dotenv').config();
const axios = require('axios');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

async function getRouteInfo(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // .env içine koy
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await axios.get(url);
    const route = response.data.routes[0].legs[0];
    
    const distanceMeters = route.distance.value;
    const durationSeconds = route.duration.value;

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: durationSeconds / 60
    };
  } catch (error) {
    console.error(' Directions API hatası:', error.message);
    return null;
  }
}


// Hava durumu verisini alır
const getWeather = async (lat, lon) => {
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&lang=tr&appid=${OPENWEATHER_API_KEY}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Hava durumu alınırken hata:", error.message);
    if (error.response) {
      console.error("Detay:", error.response.data);
    }
    throw new Error("Hava durumu alınamadı.");
  }
};

function cleanCityName(rawAddress) {
  if (!rawAddress) return '';

  const parts = rawAddress.split(',').map(p => p.trim());

  //ilçe ve ülke 
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`;
  }

  return parts[0] || '';
}

  const getCoordinates = async (cityName) => {
  const cleanedCityName = cleanCityName(cityName);
  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${cleanedCityName}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  
  try {
    console.log("Koordinat istenen şehir:", cityName);
    const response = await axios.get(url);
    if (response.data.length === 0) {

      console.warn(" Konum bulunamadı:", cityName);
      throw new Error("Konum bulunamadı.");
    }
    return response.data[0];
  } catch (error) {
    console.error("Koordinatlar alınırken hata:", error.message);
    throw new Error("Koordinatlar alınamadı.");
  }
};



const reverseGeocode = async (lat, lon) => {
  try {
    // google maps api
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
    const googleResponse = await axios.get(googleUrl);
    const googleResults = googleResponse.data.results;

    if (googleResults.length > 0) {
      const components = googleResults[0].address_components;

      const city = components.find(c => c.types.includes("administrative_area_level_1"))?.long_name;
      const district = components.find(c => c.types.includes("administrative_area_level_2"))?.long_name;

      // Hem şehir hem ilçe
      if (city && district) return `${city} - ${district}`;
      if (city) return city;
      if (district) return district;
    }

    console.warn(`⚠️ Google konum bulamadı, Mapbox'a geçiliyor...`);

    // mapbox
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_API_KEY}&language=tr`;
    const mapboxResponse = await axios.get(mapboxUrl);
    const mapboxFeatures = mapboxResponse.data.features;

    if (mapboxFeatures.length > 0) {
      const cityFeature = mapboxFeatures.find(f => f.place_type.includes("place"));
      const regionFeature = mapboxFeatures.find(f => f.place_type.includes("region"));

      if (cityFeature && regionFeature) {
        return `${regionFeature.text} - ${cityFeature.text}`;
      } else if (cityFeature) {
        return cityFeature.text;
      } else if (regionFeature) {
        return regionFeature.text;
      }
    }
    return "Konum bulunamadı";
  } catch (error) {
    console.error("Reverse geocode hatası:", error.message);
    return "Konum alınamadı";
  }
};
  
module.exports = {
  getWeather,
  getCoordinates,
  reverseGeocode,
  getRouteInfo
};

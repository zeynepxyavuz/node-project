require('dotenv').config();
const axios = require('axios');

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

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

// Şehir ismine göre koordinat bulur
const getCoordinates = async (cityName) => {
  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  
  try {
    const response = await axios.get(url);
    if (response.data.length === 0) {
      throw new Error("Konum bulunamadı.");
    }
    return response.data[0]; // { lat, lon, name, ... }
  } catch (error) {
    console.error("Koordinatlar alınırken hata:", error.message);
    throw new Error("Koordinatlar alınamadı.");
  }
};

// İki nokta arasındaki mesafeyi km cinsinden hesaplar
const haversineDistance = (coord1, coord2) => {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Reverse Geocoding (önce Google, sonra Mapbox ile fallback)
const reverseGeocode = async (lat, lon) => {
  try {
    // Google Maps API ile konum bulmaya çalış
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}&language=tr`;
    const googleResponse = await axios.get(googleUrl);
    const googleResults = googleResponse.data.results;
    
    if (googleResults.length > 0) {
      const components = googleResults[0].address_components;
      const city = components.find(c => c.types.includes("locality") || c.types.includes("administrative_area_level_1"));
      if (city) {
        return city.long_name;
      }
    }
    
    console.warn(`⚠️ Google konum bulamadı, Mapbox'a geçiliyor...`);
    
    // Google bulamazsa, Mapbox API ile konum bul
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_API_KEY}&language=tr`;
    const mapboxResponse = await axios.get(mapboxUrl);
    const mapboxFeatures = mapboxResponse.data.features;

    if (mapboxFeatures.length > 0) {
      const place = mapboxFeatures.find(feature =>
        feature.place_type.includes('place') || feature.place_type.includes('region')
      );
      if (place) {
        return place.text;
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
  haversineDistance
};

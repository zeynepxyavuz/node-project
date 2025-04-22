require('dotenv').config();
const axios = require('axios');

const getWeather = async (lat, lon) => {
  const API_KEY = process.env.OPENWEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=metric&appid=${API_KEY}`;
  
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

// Yeni: Şehir ismine göre koordinat bulur
const getCoordinates = async (cityName) => {
  const API_KEY = process.env.OPENWEATHER_API_KEY;
  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
  
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

// Yeni: İki koordinasyon arasındaki mesafeyi km cinsinden hesaplar
const haversineDistance = (coord1, coord2) => {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

async function reverseGeocode(lat, lon) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;  // .env dosyandan alacak
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}&language=tr`;

  try {
    const response = await axios.get(url);
    const results = response.data.results;
    if (results.length > 0) {
      const components = results[0].address_components;
      const city = components.find(c => c.types.includes("locality") || c.types.includes("administrative_area_level_1"));
      return city ? city.long_name : "Konum bulunamadı";
    } else {
      return "Konum bulunamadı";
    }
  } catch (error) {
    console.error("Reverse geocode hatası:", error);
    return "Konum alınamadı";
  }
}

module.exports = {
  getWeather,
  getCoordinates,
  reverseGeocode,
  haversineDistance
};

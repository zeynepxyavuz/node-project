require('dotenv').config();
const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;


async function getRouteInfo(origin, destination, routeIndex = 0) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const response = await axios.get(url);
    const routes = response.data.routes;

    if (!routes || routes.length <= routeIndex) {
      throw new Error("Seçilen rota indeksi mevcut değil.");
    }

    const selectedRoute = routes[routeIndex];
    const routeLeg = selectedRoute.legs[0];

    const distanceMeters = routeLeg.distance.value;
    const durationSeconds = routeLeg.duration.value;

    return {
      distanceKm: distanceMeters / 1000,
      durationMinutes: durationSeconds / 60,
      polyline: selectedRoute.overview_polyline.points,
      routeSteps: routeLeg.steps
    };
  } catch (error) {
    console.error('Directions API hatası:', error.message);
    return null;
  }
}

function isLatLon(str) {
  return /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(str.trim());
}

async function getCoordinatesFlexible(location) {
  if (isLatLon(location)) {
    const [lat, lon] = location.split(',').map(Number);
    return { lat, lon };
  } else {
    return await getCoordinates(location);
  }
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max&timezone=Europe/Istanbul`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo API hatası');
  
  const data = await res.json();

  if (!data.hourly || !data.hourly.time) {
    throw new Error('Saatlik veri yok');
  }

  const hourly = data.hourly.time.map((time, i) => ({
    dt: new Date(time).getTime() / 1000,
    time: time,
    temp: data.hourly.temperature_2m[i],
    wind_speed: data.hourly.windspeed_10m[i],
    code: data.hourly.weathercode[i]
  }));

  return { hourly };
}

async function getDailyWeather(lat, lon, date) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode,windspeed_10m_max&timezone=Europe/Istanbul&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo API (günlük) hatası');
  const data = await res.json();
  if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
    throw new Error('Günlük veri yok');
  }

  return {
    date: data.daily.time[0],
    max_temp: data.daily.temperature_2m_max[0],
    min_temp: data.daily.temperature_2m_min[0],
    wind_speed: data.daily.windspeed_10m_max[0],
    weather_code: data.daily.weathercode[0]
  };
}

function cleanLocation(fullLocation) {
  let parts = fullLocation.split(',').map(p => p.trim());

  if (parts.length === 0) return '';
  const city = parts[0]; 
  const country = parts.length > 1 ? parts[parts.length - 1] : 'Türkiye';
  if (city.toLowerCase() === country.toLowerCase()) {
    return city;
  }
  return `${city}, ${country}`;
}


const getCoordinates = async (cityName) => {
  const cleanedCity = cleanLocation(cityName);
  try {
    console.log("Google ile koordinat aranıyor:", cityName);
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanedCity)}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(googleUrl);

    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      console.log("Google ile bulundu:", cleanedCity);
      return { lat: location.lat, lon: location.lng };
    } else {
      throw new Error("Google konum bulamadı.");
    }

  } catch (error) {
    console.error("Google koordinat hatası:", error.message);
    return null;
  }
};

const reverseGeocode = async (lat, lon) => {
  try {
    const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`;
    const googleResponse = await axios.get(googleUrl);
    const googleResults = googleResponse.data.results;

    if (googleResults.length > 0) {
      const components = googleResults[0].address_components;
      const city = components.find(c => c.types.includes("administrative_area_level_1"))?.long_name;
      const district = components.find(c => c.types.includes("administrative_area_level_2"))?.long_name;

      if (city && district) return `${city} - ${district}`;
      if (city) return city;
      if (district) return district;
      console.log("🔍 Google Geocode sonucu:", JSON.stringify(googleResults, null, 2));

    }

    console.warn("Google konum bulamadı, Mapbox'a geçiliyor...");

    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${MAPBOX_API_KEY}`;
    const mapboxResponse = await axios.get(mapboxUrl);
    const mapboxFeatures = mapboxResponse.data.features;

    if (mapboxFeatures.length > 0) {
      const cityFeature = mapboxFeatures.find(f =>
  ["place", "locality", "neighborhood"].some(type => f.place_type.includes(type))
);
const regionFeature = mapboxFeatures.find(f =>
  ["region", "district"].some(type => f.place_type.includes(type))
);

      if (cityFeature && regionFeature) {
        return `${regionFeature.text} - ${cityFeature.text}`;
      } else if (cityFeature) {
        return cityFeature.text;
      } else if (regionFeature) {
        return regionFeature.text;
      }
    }
    console.warn("⚠️ Mapbox sonuçları boş.");

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
  getRouteInfo,
  cleanLocation,
  getCoordinatesFlexible,
  getDailyWeather
};

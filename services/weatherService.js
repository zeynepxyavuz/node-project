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

module.exports = { getWeather };

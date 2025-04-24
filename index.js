const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getWeather, getCoordinates, reverseGeocode, haversineDistance } = require('./services/weatherService');
const dayjs = require('dayjs'); 

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('public'));

app.post('/route-weather', async (req, res) => {
  const { origin, destination, time, forecastDay, interval } = req.body;

  if (!origin || !destination || !time || forecastDay === undefined || interval === undefined) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  const parsedInterval = parseInt(interval, 10); // dakika cinsinden
  const parsedDay = parseInt(forecastDay, 10);
  try {
    const originCoord = await getCoordinates(origin);
    const destinationCoord = await getCoordinates(destination);

    if (!originCoord || !destinationCoord) {
      return res.status(404).json({ error: 'Konumlar bulunamadı' });
    }

    const distance = haversineDistance(originCoord, destinationCoord); // km
    const avgSpeed = 80; // km/h
    const travelHours = distance / avgSpeed;
    const travelMinutes = travelHours * 60;

    const numberOfPoints = Math.ceil(travelMinutes / parsedInterval);

    const startDate = new Date();
    const [hour, minute] = time.split(':');
    startDate.setHours(parseInt(hour));
    startDate.setMinutes(parseInt(minute));
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);

    const hourlyForecasts = [];

    for (let i = 0; i < numberOfPoints; i++) {
      const minutesAfterStart = i * parsedInterval;
      const estimatedTime = new Date(startDate.getTime() + minutesAfterStart * 60 * 1000);

      const ratio = i / numberOfPoints;
      const lat = originCoord.lat + (destinationCoord.lat - originCoord.lat) * ratio;
      const lon = originCoord.lon + (destinationCoord.lon - originCoord.lon) * ratio;

      const weatherData = await getWeather(lat, lon);
      const hourly = weatherData.hourly;

      const targetHourIndex = Math.round((estimatedTime.getTime() - Date.now()) / (60 * 60 * 1000));
      const hourData = hourly[targetHourIndex];

      if (hourData) {
        const cityName = await reverseGeocode(lat, lon);
        hourlyForecasts.push({
          estimatedTime: estimatedTime.toISOString(),
          location: cityName,
          lat,
          lon,
          weather: {
            temp: hourData.temp,
            weather: hourData.weather,
            time: dayjs(hourData.dt * 1000).format('HH:mm')
          }
        });
        console.log(`📍 Nokta ${i + 1}: ${cityName}, ${dayjs(hourData.dt * 1000).format('HH:mm')}`);
      } else {
        console.warn(`⚠️ Uygun saatlik veri bulunamadı (tahmini saat: ${estimatedTime.toISOString()})`);
      }
    }

    console.log(`✅ Toplam ${hourlyForecasts.length} hava durumu verisi döndürüldü.`);
    res.json(hourlyForecasts);
  } catch (error) {
    console.error("Rota hava durumu hatası:", error);
    res.status(500).json({ error: 'Rota hava durumu alınamadı', detay: error.message });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

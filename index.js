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

// app.get('/', (req, res) => {
//   res.send('Hoş geldiniz! API doğru çalışıyor. Hava durumu için /weather endpoint\'ini kullanın.');
// });

// app.get('/weather', async (req, res) => {
//   const { lat, lon } = req.query;

//   if (!lat || !lon) {
//     return res.status(400).json({ error: 'lat ve lon parametreleri zorunludur.' });
//   }

//   try {
//     const data = await getWeather(lat, lon);
//     res.json(data);
//   } catch (error) {
//     res.status(500).json({ error: 'Hava durumu alınamadı.', detay: error.message });
//   }
// });

// Rota üzerindeki hava durumu verisi
app.post('/route-weather', async (req, res) => {
  const { origin, destination, time, forecastDay, interval } = req.body;

  if (!origin || !destination || !time || forecastDay === undefined || interval === undefined) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  const parsedInterval = parseInt(interval, 10) || 1;
  const parsedDay = parseInt(forecastDay, 10) || 0;
  try {
    const originCoord = await getCoordinates(origin);
    const destinationCoord = await getCoordinates(destination);

    if (!originCoord || !destinationCoord) {
      return res.status(404).json({ error: 'Konumlar bulunamadı' });
    }

    const distance = haversineDistance(originCoord, destinationCoord); // km
    const avgSpeed = 80; // km/h
    const travelHours = Math.ceil(distance / avgSpeed);

    const startDate = new Date();
    const [hour, minute] = time.split(':');
    startDate.setHours(parseInt(hour));
    startDate.setMinutes(parseInt(minute));
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);

    const hourlyForecasts = [];

    // Seçilen günün başlangıcı
    const startOfDay = dayjs().add(parsedDay, 'day').startOf('day'); // ✅ Değişken adı düzeltildi
    const forecastDayUnix = startOfDay.unix();

    for (let i = 0; i <= travelHours; i++) {
      const estimatedTime = new Date(startDate.getTime() + i * 60 * 60 * 1000);
      const lat = originCoord.lat + (destinationCoord.lat - originCoord.lat) * (i / travelHours);
      const lon = originCoord.lon + (destinationCoord.lon - originCoord.lon) * (i / travelHours);

      const weatherData = await getWeather(lat, lon);
      const hourly = weatherData.hourly;

      const dayData = hourly.filter(hour => hour.dt >= forecastDayUnix && hour.dt < forecastDayUnix + 86400);

      let intervalData = [];
      switch (parsedInterval) {
        case 15:
          intervalData = dayData.filter((_, index) => index % 4 === 0);
          break;
        case 30:
          intervalData = dayData.filter((_, index) => index % 2 === 0);
          break;
        case 45:
          intervalData = dayData.filter((_, index) => index % 3 === 0);
          break;
        case 60:
        default:
          intervalData = dayData;
          break;
      }

      for (const hour of intervalData) {
        const cityName = await reverseGeocode(lat, lon); // await unutma!
        hourlyForecasts.push({
          estimatedTime: new Date(estimatedTime).toISOString(),
          location: cityName,
          lat,
          lon,
          weather: {
            temp: hour.temp,
            weather: hour.weather,
            time: dayjs(hour.dt * 1000).format('HH:mm')
          }
        });
      }
    }

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

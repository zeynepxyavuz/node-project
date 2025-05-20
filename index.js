const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getWeather, getCoordinates, reverseGeocode, getRouteInfo, getCoordinatesFlexible } = require('./services/service');
const dayjs = require('dayjs');
const axios = require('axios');
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('public'));


app.post('/route-weather', async (req, res) => {
  const { origin, destination, time, forecastDay, interval, routeIndex } = req.body;

  if (!origin || !destination || !time || forecastDay === undefined || interval === undefined) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  const parsedInterval = parseInt(interval, 10);
  const parsedDay = parseInt(forecastDay, 10);
  const selectedRouteIndex = routeIndex !== undefined ? parseInt(routeIndex, 10) : 0;

  try {
    const originCoord = await getCoordinatesFlexible(origin);
    const destinationCoord = await getCoordinatesFlexible(destination);  

    if (!originCoord || !destinationCoord) {
      return res.status(404).json({ error: 'Konumlar bulunamadı' });
    }
    // getRouteInfo fonksiyonunu routeIndex parametreli hale getir
    const distance = await getRouteInfo(origin, destination, selectedRouteIndex);

    if (!distance) {
      return res.status(500).json({ error: 'Rota bilgisi alınamadı' });
    }

    const avgSpeed = 80; // km/h
    const travelMinutes = (distance.distanceKm / avgSpeed) * 60;
    const numberOfPoints = Math.ceil(travelMinutes / parsedInterval);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + parsedDay);
    const [hour, minute] = time.split(':');
    startDate.setHours(parseInt(hour));
    startDate.setMinutes(parseInt(minute));
    startDate.setSeconds(0);
    startDate.setMilliseconds(0);

    const hourlyForecasts = [];

    for (let i = 0; i < numberOfPoints; i++) {
      const minutesAfterStart = i * parsedInterval;
      const estimatedTime = new Date(startDate.getTime() + minutesAfterStart * 60000);

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
            wind_speed: hourData.wind_speed,
            time: dayjs(hourData.dt * 1000).format('HH:mm')
          }
        });
      } else {
        console.warn(` Uygun saatlik veri bulunamadı (tahmini saat: ${estimatedTime.toISOString()})`);
      }
    }
    const arrivalTime = new Date(startDate.getTime() + travelMinutes * 60000);
    const finalWeatherData = await getWeather(destinationCoord.lat, destinationCoord.lon);
    const baseTimestamp = finalWeatherData.hourly[0].dt * 1000;
    const timeDiffMs = arrivalTime.getTime() - baseTimestamp;
    const finalHourIndex = Math.round(timeDiffMs / (60 * 60 * 1000));
    const finalHourData = finalWeatherData.hourly[finalHourIndex];

    if (finalHourData) {
      const finalCityName = await reverseGeocode(destinationCoord.lat, destinationCoord.lon);
      hourlyForecasts.push({
        estimatedTime: arrivalTime.toISOString(),
        location: finalCityName,
        lat: destinationCoord.lat,
        lon: destinationCoord.lon,
        weather: {
          temp: finalHourData.temp,
          weather: finalHourData.weather,
          wind_speed: finalHourData.wind_speed,
          time: dayjs(finalHourData.dt * 1000).format('HH:mm')
        }
      });
      console.log(` Varış Noktası: ${finalCityName}, ${dayjs(finalHourData.dt * 1000).format('HH:mm')}`);
    } else {
      console.warn(" Varış noktasına ait saatlik veri bulunamadı.");
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

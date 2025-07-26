const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getWeather, getCoordinates, reverseGeocode, getRouteInfo, getCoordinatesFlexible, getDailyWeather } = require('./services/service');
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

      const cityName = await reverseGeocode(lat, lon);

      if (parsedDay <= 6) {
        const weatherData = await getWeather(lat, lon);
        const hourly = weatherData.hourly;
        const estimatedTimestamp = Math.floor(estimatedTime.getTime() / 1000);

        const matchedHour = hourly.find(h =>
          Math.abs(h.dt - estimatedTimestamp) < 3600
        );

        if (matchedHour) {
          hourlyForecasts.push({
            estimatedTime: estimatedTime.toISOString(),
            location: cityName,
            lat,
            lon,
            weather: {
              temperature_2m: matchedHour.temp,
              wind_speed_10m: matchedHour.wind_speed,
              weatherCode: matchedHour.code,
              time: dayjs(estimatedTime).format('HH:mm')
            }
          });
        } else {
          console.warn(`Saatlik veri bulunamadı: ${estimatedTime.toISOString()}`);
        }
      } else {
        const dateStr = dayjs(estimatedTime).format('YYYY-MM-DD');
        const dailyData = await getDailyWeather(lat, lon, dateStr);
        hourlyForecasts.push({
          estimatedTime: estimatedTime.toISOString(),
          location: cityName,
          lat,
          lon,
          weather: {
            temperature_2m_max: dailyData.max_temp,
            temperature_2m_min: dailyData.min_temp,
            wind_speed_10m: dailyData.wind_speed,
            weatherCode: dailyData.weather_code,
            time: dayjs(estimatedTime).format('DD.MM') + " (günlük)"
          }
        });
      }
    }

    // Varış noktası için son hava durumu
    //saatlik
    const arrivalTime = new Date(startDate.getTime() + travelMinutes * 60000);
    const arrivalCity = await reverseGeocode(destinationCoord.lat, destinationCoord.lon);

    if (parsedDay <= 6) {
      const finalWeatherData = await getWeather(destinationCoord.lat, destinationCoord.lon);
      const arrivalTimestamp = Math.floor(arrivalTime.getTime() / 1000);
      const matchedArrival = finalWeatherData.hourly.find(h =>
        Math.abs(h.dt - arrivalTimestamp) < 3600
      );

      if (matchedArrival) {
        hourlyForecasts.push({
          estimatedTime: arrivalTime.toISOString(),
          location: arrivalCity,
          lat: destinationCoord.lat,
          lon: destinationCoord.lon,
          weather: {
            temperature_2m: matchedArrival.temp,
            wind_speed_10m: matchedArrival.wind_speed,
            weatherCode: matchedArrival.code,
            time: dayjs(arrivalTime).format('HH:mm')
          }
        });
      }
      //günlük
    } else {
      const arrivalDateStr = dayjs(arrivalTime).format("YYYY-MM-DD");
      const dailyArrival = await getDailyWeather(destinationCoord.lat, destinationCoord.lon, arrivalDateStr);

      hourlyForecasts.push({
        estimatedTime: arrivalTime.toISOString(),
        location: arrivalCity,
        lat: destinationCoord.lat,
        lon: destinationCoord.lon,
        weather: {
          temperature_2m_max: dailyArrival.max_temp,
          temperature_2m_min: dailyArrival.min_temp,
          wind_speed_10m: dailyArrival.wind_speed,
          weatherCode: dailyArrival.weather_code,
          time: dayjs(arrivalTime).format("DD.MM") + " (günlük)"
        }
      });
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

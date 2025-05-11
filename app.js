const express = require('express');
const axios = require('axios');
const app = express();

const GOOGLE_MAPS_API_KEY = 'AIzaSyAaA3z_CKnx7bMc5Gz5b5K2tVJM4Rx6PP4';

// enlem ve boylamı şehir ismiyle eşleştirmek için
async function getCity(lat, lng) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const res = await axios.get(url, {
    params: {
      latlng: `${lat},${lng}`,
      key: GOOGLE_MAPS_API_KEY,
    },
  });

  const result = res.data.results[0];
  if (!result || !result.address_components) {
    console.log('Adres bileşenleri bulunamadı');
    return null; // şehir yoksa
  }

  const city = result.address_components.find((component) =>
    component.types.includes('locality') || component.types.includes('administrative_area_level_1')
  );
  return city ? city.long_name : null;
}

// iki şehir arasındaki enlem boylamını alıyorum
app.get('/get-cities', async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin veya destination eksik' });
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const data = response.data;
    if (data.status !== 'OK') {
      return res.status(400).json({ error: 'Yol bulunamadı' });
    }

    const steps = data.routes[0].legs[0].steps;
    const visited = new Set();
    const cities = []; // Şehirleri toplamak için

    // Her adımda enlem ve boylam alıp şehir ismini topluyoruz
    for (const step of steps) {
      const { lat, lng } = step.end_location;
      const city = await getCity(lat, lng);  // getCity fonksiyonu şehir adı döndürüyor

      if (city && !visited.has(city)) {
        visited.add(city);  
        cities.push(city); 
      }
    }

    // tekrar edenleri kaldır
    const uniqueCities = [...new Set(cities)];

    
    res.json({ cities: uniqueCities });
  } catch (error) {
    console.log('Hata:', error.message);
    res.status(500).json({ error: 'Bir hata oluştu' });
  }
}); //http://localhost:3000/get-cities?origin=Bursa&destination=Istanbul
async function getWeather(lat, lon) {
  const url = 'https://api.openweathermap.org/data/3.0/onecall';
  const res = await axios.get(url, {
    params: {
      lat,
      lon,
      exclude: 'minutely,alerts',
      units: 'metric',
      lang: 'tr',
      appid: '0d8801f9c9f4999e7d5a6dce8baddef9',
    },
  });
  return res.data; // Hava durumu verisini döndür
}

//şu an burada iki rota arasındaki rotaların hava durumunu görebiliyorum, saatlik de ekledim.
app.get('/weather', async (req, res) => {
  const { origin, destination } = req.query;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin veya destination eksik' });
  }

  try {
    //rotayı alıyorum
    const directionsRes = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin,
        destination,
        key: GOOGLE_MAPS_API_KEY,
      },
    });

    const data = directionsRes.data;
    if (data.status !== 'OK') {
      return res.status(400).json({ error: 'Yol bulunamadı' });
    }

    const steps = data.routes[0].legs[0].steps;
    const results = [];

    for (const step of steps) {
      const { lat, lng } = step.end_location;
      const city = await getCity(lat, lng);
      if (!city) continue;

      const weather = await getWeather(lat, lng);
      results.push({
        city,
        lat,
        lng,
        weather: {
          current: weather.current.weather[0].description, //hava d açıklaması
          temperature: weather.current.temp,// derece
          hourly: weather.hourly.slice(0, 1).map(h => ({
            time: new Date(h.dt * 1000).toLocaleTimeString('tr-TR'),
            temp: h.temp,
            desc: h.weather[0].description
          })),
        },
      });
    }
    // aynı şehirlerin tekrarını engelle
    const uniqueResults = [];
    const seen = new Set();
    for (const item of results) {
      if (!seen.has(item.city)) {
        seen.add(item.city);
        uniqueResults.push(item);
      }
    }

    res.json({ route: uniqueResults });
  } catch (error) {
    console.log('Hata:', error.message);
    res.status(500).json({ error: 'Sunucu hatası oluştu' });
  }
});
//http://localhost:3000/weather?origin=Bursa&destination=Istanbul

//burada tek bir şehir için saatlik alıyorsun TEK BİR ŞEHİR
app.get('/hourly-weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat veya lon eksik' });
  }

  try {
    const weatherResponse = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: {
        lat,
        lon,
        exclude: 'current,daily,alerts',  // sadece hourly kalsın, buraya yazarsan çıkarırsın.
        units: 'metric',
        lang: 'tr',
        appid: '0d8801f9c9f4999e7d5a6dce8baddef9'
      }
    });

    const hourlyData = weatherResponse.data.hourly;
    res.json({ hourly: hourlyData });
  } catch (error) {
    console.error('Hata:', error.message);
    res.status(500).json({ error: 'Saatlik hava durumu alınamadı' });
  }
});//http://localhost:3000/hourly-weather?lat=40.7128&lon=29.2266

app.listen(3000, () => {
  console.log('http://localhost:3000/ adresinde çalışıyor');
});

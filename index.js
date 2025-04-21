const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getWeather } = require('./services/weatherService');

dotenv.config();

const app = express();
app.use(cors());

// Statik dosya servisi
app.use(express.static('public'));  // Public klasöründen statik dosyalar sunulacak

// Ana sayfa endpoint'i
app.get('/', (req, res) => {
  res.send('Hoş geldiniz! API doğru çalışıyor. Hava durumu için /weather endpoint\'ini kullanın.');
});

// Hava durumu endpoint'i
app.get('/weather', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat ve lon parametreleri zorunludur.' });
  }

  try {
    const data = await getWeather(lat, lon);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Hava durumu alınamadı.', detay: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});

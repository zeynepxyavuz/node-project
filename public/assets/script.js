
let map;
    let directionsService;
    let directionsRenderer;
    let originAutocomplete, destinationAutocomplete;

    function initMap() {
      map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 41.0082, lng: 28.9784 },
        zoom: 10,
      });

      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer();
      directionsRenderer.setMap(map);

      const geocoder = new google.maps.Geocoder();
      
      map.addListener("click", (e) => {
        const lat = e.latLng.lat();
        const lon = e.latLng.lng();
        getWeatherData(lat, lon);
      });

      initAutocomplete();
    }

    function initAutocomplete() {
      originAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById('origin'), 
        { types: ['(cities)'] }
      );

      destinationAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById('destination'),
        { types: ['(cities)'] }
      );
    }
    
  async function getWeatherData(lat, lon) {
  const res = await fetch(`/weather?lat=${lat}&lon=${lon}`);
  const data = await res.json();
  
  if (!data || !data.daily || !data.hourly) {
    console.error("Geçersiz veri:", data);
    return;
  }

  renderDaily(data.daily);
  renderHourly(data.hourly.slice(0, 24));
}

function renderDaily(daily) {
  const container = document.getElementById('daily-weather');
  container.innerHTML = '';
  daily.forEach(day => {
    const date = new Date(day.dt * 1000).toLocaleDateString();
    container.innerHTML += `
      <div class="weather-card">
        <div class="weather-date">${date}</div>
        <img class="weather-icon" src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" />
        <div class="weather-description">${day.weather[0].description}</div>
        <div class="weather-temp-min">Min: ${Math.round(day.temp.min)}°C</div>
        <div class="weather-temp-max">Max: ${Math.round(day.temp.max)}°C</div>
        <div class="weather-wind">Rüzgar: ${Math.round(day.wind_speed * 3.6)} km/s</div>
      </div>
    `;
  });
}



function renderHourly(hourly) {
  const container = document.getElementById('hourly-weather');
  container.innerHTML = '';
  hourly.forEach(hour => {
    const time = new Date(hour.dt * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    container.innerHTML += `
      <div class="weather-card">
        <div>${time}</div>
        <img src="https://openweathermap.org/img/wn/${hour.weather[0].icon}@2x.png" />
        <div>${hour.weather[0].description}</div>
        <div>Sıcaklık: ${Math.round(hour.temp)}°C</div>
        <div>Rüzgar: ${Math.round(hour.wind_speed * 3.6)} km/s</div>
      </div>
    `;
  });
}

async function calculateRoute() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const time = document.getElementById("time").value;
  const interval = document.getElementById("interval").value;
  const forecastDay = document.getElementById("forecastDay").value;

  const button = document.getElementById("calculateBtn");
  button.disabled = true;

  if (!origin || !destination || !time) {
    alert("Lütfen tüm alanları doldurun.");
    button.disabled = false;
    return;
  }

  //rota çiz
  const request = {
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
  };

  directionsService.route(request, (result, status) => {
    if (status === "OK") {
      directionsRenderer.setDirections(result);
    } else {
      console.error("Rota çizilemedi:", status);
    }
  });

  try {
    const res = await fetch('/route-weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, time, interval, forecastDay })
    });

    const data = await res.json();

    if (!Array.isArray(data)) {
      console.error("Beklenen formatta değil:", data);
      alert("Sunucudan geçerli veri alınamadı.");
      return;
    }

    const container = document.getElementById('route-weather');
    container.innerHTML = '';

    data.forEach((item, index) => {
      const date = new Date(item.estimatedTime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${day}.${month} ${hours}:${minutes}`;
      const weather = item.weather;
      const iconUrl = `https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`;
      const desc = weather.weather[0].description;
      const temp = weather.temp;
      const location = item.location || "Konum bilinmiyor";

      const windSpeed = typeof weather.wind_speed === 'number' ? `${Math.round(weather.wind_speed * 3.6)} km/s` : "Veri yok";

      container.innerHTML += `
        <div class="weather-card">
          <div><strong>${timeStr}</strong></div>
          <div><strong>${location}</strong></div>
          <img src="${iconUrl}" />
          <div>${desc}</div>
          <div>${Math.round(temp)}°C</div>
          <div>Rüzgar: ${windSpeed}</div>
        </div>
      `;
    });

  } catch (error) {
    console.error("Rota hava durumu alınamadı:", error);
    alert("Bir hata oluştu. Lütfen tekrar deneyin.");
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
    const map = document.getElementById("map");
    const showMapBtn = document.getElementById("show-map-btn");
    const hideMapBtn = document.getElementById("hide-map-btn");
    const weatherCardsContainer = document.getElementById("weatherCardsContainer");

    // Hava durumu kartlarını temizleyen fonksiyon
    function clearWeatherData() {
      if (weatherCardsContainer) {
        weatherCardsContainer.innerHTML = '';
      }
    }

    function updateMapButtons() {
      if (window.innerWidth <= 768) {
        if (map.style.display === "none" || map.offsetParent === null) {
          showMapBtn.classList.remove("d-none");
          hideMapBtn.classList.add("d-none");
        } else {
          showMapBtn.classList.add("d-none");
          hideMapBtn.classList.remove("d-none");
        }
      } else {
        showMapBtn.classList.add("d-none");
        hideMapBtn.classList.add("d-none");
        map.style.display = "block";
      }
    }

    showMapBtn.addEventListener("click", () => {
      map.style.display = "block";
      updateMapButtons();
    });

    hideMapBtn.addEventListener("click", () => {
      map.style.display = "none";
      updateMapButtons();
    });

    // Nereden ve Nereye butonlarına tıklanınca hava durumu kartlarını temizle
    const fromButton = document.getElementById("fromButton");
    const toButton = document.getElementById("toButton");

    if (fromButton) {
      fromButton.addEventListener("click", clearWeatherData);
    }

    if (toButton) {
      toButton.addEventListener("click", clearWeatherData);
    }

    // Sayfa yüklendiğinde ve boyut değiştiğinde kontrol et
    updateMapButtons();
    window.addEventListener("resize", updateMapButtons);
});
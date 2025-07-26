
let map;
let directionsService;
let directionsRenderer;
let originAutocomplete, destinationAutocomplete;

function capitalizeFirstLetter(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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


function getOpenMeteoIconByCode(code) {
  if (code === undefined || code === null) return '/assets/icon/unknown.png';

  if ([0].includes(code)) return '/assets/icon/sun.png';                        // Açık
  if ([1, 2].includes(code)) return '/assets/icon/partly-cloudy.png';          // Parçalı bulutlu
  if ([3].includes(code)) return '/assets/icon/overcast.png';                  // Kapalı
  if ([45, 48].includes(code)) return '/assets/icon/foog.png';                  // Sis
  if ([51, 53, 55].includes(code)) return '/assets/icon/drizzle.png';          // Çiseleme
  if ([61, 63, 65].includes(code)) return '/assets/icon/heavy-rain.png';       // Yağmur
  if ([66, 67].includes(code)) return '/assets/icon/heavy-rain.png';           // Donan yağmur
  if ([71, 73, 75, 77].includes(code)) return '/assets/icon/snow.png';         // Kar
  if ([80, 81, 82].includes(code)) return '/assets/icon/heavy-rain.png';       // Sağanak
  if ([85, 86].includes(code)) return '/assets/icon/snow.png';                 // Sağanak kar
  if ([95, 96, 99].includes(code)) return '/assets/icon/thunderstorm.png';     // Gök gürültülü fırtına

  return '/assets/icon/unknown.png'; // Bilinmeyen
}

let routeRenderers = []; // Önceki rotaları temizlemek için

async function calculateRoute() {
  const origin = document.getElementById("origin").value;
  const destination = document.getElementById("destination").value;
  const time = document.getElementById("time").value;
  const interval = document.getElementById("interval").value;
  const forecastDay = document.getElementById("forecastDay").value;

  const button = document.getElementById("calculateBtn");
  const loader = document.getElementById("loader");
  const container = document.getElementById("route-weather");

  button.disabled = true;
  container.innerHTML = '';
  loader.style.display = 'block';

  if (!origin || !destination || !time) {
    alert("Lütfen tüm alanları doldurun.");
    button.disabled = false;
    loader.style.display = 'none';
    return;
  }

  // Eski rotaları temizle
  routeRenderers.forEach(r => r.setMap(null));
  routeRenderers = [];
  const polylines = [];

  const request = {
    origin: origin,
    destination: destination,
    travelMode: google.maps.TravelMode.DRIVING,
    provideRouteAlternatives: true,
  };
  directionsService.route(request, (result, status) => {
    if (status === "OK" && result.routes) {
      const colors = ['#FF0000', '#008000', '#0000FF', '#FF8C00'];

      result.routes.forEach((route, index) => {

        const renderer = new google.maps.DirectionsRenderer({
          map: map,
          directions: result,
          routeIndex: index,
          suppressPolylines: false, // default: rota çizilir
          polylineOptions: {
            strokeColor: colors[index % colors.length],
            strokeOpacity: 0.5,
            strokeWeight: 6,
          },
        });
        routeRenderers.push(renderer);

        const routeColor = colors[index % colors.length];

        const polyline = new google.maps.Polyline({
          path: route.overview_path,
          strokeColor: routeColor,
          strokeOpacity: 0.0, // Görünmesin, sadece tıklanabilir olsun
          strokeWeight: 15,
          zIndex: 9999,
          map: map
        });
        if (!window.polylines) {
          window.polylines = [];
        }

        window.polylines.push({
          polyline,
          originalColor: routeColor
        });

        polylines.push({
          polyline,
          originalColor: routeColor
        });

        polyline.addListener("click", () => {
          console.log("Polyline'a tıklandı.");
          console.log("Tıklanan rota index:", index);

          //güncelle
          polylines.forEach((pl, i) => {
            if (i === index) {
              pl.polyline.setOptions({
                strokeColor: pl.originalColor,
                strokeOpacity: 1.0,
                strokeWeight: 8,
                zIndex: 9999
              });
            } else {
              pl.polyline.setOptions({
                strokeColor: '#C0C0C0',
                strokeOpacity: 0.3,
                strokeWeight: 4,
                zIndex: 1
              });
            }
          });

          const weatherContainer = document.getElementById("route-weather");
          if (weatherContainer) weatherContainer.innerHTML = '';

          const loader = document.getElementById("loader");
          if (loader) loader.style.display = 'block';

          const startLatLng = route.legs[0].start_location;
          const endLatLng = route.legs[0].end_location;

          fetch("/route-weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              origin: `${startLatLng.lat()},${startLatLng.lng()}`,
              destination: `${endLatLng.lat()},${endLatLng.lng()}`,
              routeIndex: parseInt(index, 10),
              time,
              interval,
              forecastDay
            }),
          })
            .then(res => res.json())
            .then(data => {
              console.log("Hava durumu verisi:", data);
              if (loader) loader.style.display = "none";
              showWeatherCardsOnMap(data);
            })
            .catch(err => {
              console.error("Hava durumu alınamadı:", err);
            });
        });
      });
    } else {
      console.error("Rota çizilemedi:", status);
    }
  });

  // Weather isteği
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

    container.innerHTML = '';

    data.forEach((item) => {
      const date = new Date(item.estimatedTime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const weather = item.weather;
      const location = item.location || "Konum bilinmiyor";
      const windSpeed = typeof weather.wind_speed_10m === 'number' ? `${Math.round(weather.wind_speed_10m)} km/s` : "Veri yok";
      const iconPath = getOpenMeteoIconByCode(weather.weatherCode);
      let temp;
      if (typeof weather.temperature_2m === 'number') {
        temp = `${Math.round(weather.temperature_2m)}`;
      } else if (
        typeof weather.temperature_2m_max === 'number' &&
        typeof weather.temperature_2m_min === 'number'
      ) {
        temp = `${Math.round(weather.temperature_2m_min)}°C / ${Math.round(weather.temperature_2m_max)}`;
      } else {
        temp = "Veri yok";
      }
      container.innerHTML += `
      <div class="weather-card">
        <img src="${iconPath}" class="weather-icon" alt="icon" />
        <div class="loc">
          <div><strong>${timeStr}</strong></div>
          <div><strong>${location}</strong></div>
        </div>
        <div class="temp-windspeed">
          <div class="temp"><img src="/assets/icon/sicaklik.svg" class="inline-icon" />${temp}°C</div>
          <div class="wind"><img src="/assets/icon/ruzgar.svg" class="inline-icon" /> ${windSpeed}</div>
        </div>
      </div>
    `;
    });

  } catch (error) {
    console.error("Rota hava durumu alınamadı:", error);
    alert("Bir hata oluştu. Lütfen tekrar deneyin.");
  } finally {
    loader.style.display = 'none';
    button.disabled = false;
  }
}

const select = document.getElementById("forecastDay");
const daysOfWeek = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
for (let i = 0; i < 15; i++) {
  const date = new Date();
  date.setDate(date.getDate() + i);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const formattedDate = `${day}.${month}.${year}`;
  const dayName = i === 0 ? "Bugün" : daysOfWeek[date.getDay()];

  const option = document.createElement("option");
  option.value = i;
  option.textContent = `${formattedDate} - ${dayName}`;

  select.appendChild(option);
}
function showWeatherCardsOnMap(data) {
  const container = document.getElementById("route-weather");
  if (!container) return;

  container.innerHTML = '';

  data.forEach((item) => {
    const date = new Date(item.estimatedTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const weather = item.weather;
    if (!weather) return;

    const location = item.location || "Konum bilinmiyor";

    const iconPath = getOpenMeteoIconByCode(weather.weatherCode); // kendi ikon eşlemen
    let tempText = "Veri yok";

    if ('temperature_2m' in weather) {
      tempText = `${Math.round(weather.temperature_2m)}°C`;
    } else if ('temperature_2m_min' in weather && 'temperature_2m_max' in weather) {
      tempText = `${Math.round(weather.temperature_2m_min)}°C / ${Math.round(weather.temperature_2m_max)}°C`;
    }

    const windSpeed = typeof weather.wind_speed_10m === 'number'
      ? `${Math.round(weather.wind_speed_10m)} km/s`
      : "Veri yok";

    const cardHTML = `
      <div class="weather-card">
        <img src="${iconPath}" class="weather-icon" alt="weather icon" />
        <div class="loc">
          <div><strong>${timeStr}</strong></div>
          <div><strong>${location}</strong></div>
        </div>
        <div class="temp-windspeed">
          <div class="temp"><img src="/assets/icon/sicaklik.svg" class="inline-icon" />${tempText}</div>
          <div class="wind"><img src="/assets/icon/ruzgar.svg" class="inline-icon" /> ${windSpeed}</div>
        </div>
      </div>
    `;

    container.innerHTML += cardHTML;
  });
}


document.getElementById('forecastDay').addEventListener('change', function () {
  const selectedIndex = this.selectedIndex;
  const warningBox = document.getElementById('dailyWarning');
  const intervalSelect = document.getElementById('interval');

  if (selectedIndex >= 7) {
    warningBox.style.display = 'block';

    intervalSelect.disabled = true;
    intervalSelect.title = "8. günden sonrası için aralık seçilemez.";

    intervalSelect.value = "60"; //1 saatte kilitle
  } else {
    warningBox.style.display = 'none';

    intervalSelect.disabled = false;
    intervalSelect.title = "";
  }
});

function resetPolylinesToDefault() {
  if (window.polylines && window.polylines.length > 0) {
    window.polylines.forEach(({ polyline, originalColor }) => {
      polyline.setOptions({
        strokeColor: '#C0C0C0',
        strokeOpacity: 0.3,
        strokeWeight: 4,
        zIndex: 1
      });
    });
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const map = document.getElementById("map");
  const fromInput = document.getElementById("origin");
  const toInput = document.getElementById("destination");
  const showRouteBtn = document.getElementById("calculateBtn");
  const weatherContainer = document.getElementById("route-weather");

  if (map) {
    map.style.display = "none";
  }

  if (fromInput) {
    fromInput.addEventListener("focus", () => {
      fromInput.value = '';
    });
  }

  if (toInput) {
    toInput.addEventListener("focus", () => {
      toInput.value = '';
    });
  }

  const toggleMapBtn = document.createElement("button");
  toggleMapBtn.id = "toggleMap";
  toggleMapBtn.textContent = "🗺 Haritayı Göster";
  toggleMapBtn.style.display = "none";
  toggleMapBtn.style.marginTop = "10px";

  // Butonu .rota-buton div'ine ekle
  const rotaButonDiv = document.querySelector(".rota-buton");
  if (rotaButonDiv) {
    rotaButonDiv.appendChild(toggleMapBtn);
  }

  let mapVisible = false;
  toggleMapBtn.addEventListener("click", () => {
    mapVisible = !mapVisible;
    map.style.display = mapVisible ? "block" : "none";
    toggleMapBtn.textContent = mapVisible ? "🗺 Haritayı Gizle" : "🗺 Haritayı Göster";

    const openInMapsBtn = document.getElementById("openInMapsBtn");

    if (mapVisible) {
      // 👉 Her açıldığında güncel verileri al
      const origin = document.getElementById("origin").value.trim();
      const destination = document.getElementById("destination").value.trim();

      if (origin && destination) {
        const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
        openInMapsBtn.href = mapsUrl;
        openInMapsBtn.style.display = "inline-block";
      } else {
        // origin veya destination boşsa butonu gizle
        openInMapsBtn.style.display = "none";
      }

      // Eğer harita Google Maps API ile render ediliyorsa resize tetikle
      if (window.mapInstance) {
        if (window.google?.maps?.event?.trigger) {
          google.maps.event.trigger(window.mapInstance, "resize");
        }
        if (window.mapInstance.invalidateSize) {
          window.mapInstance.invalidateSize();
        }
      }
    } else {
      // Harita kapalıysa butonu gizle
      openInMapsBtn.style.display = "none";
    }
  });
  //showroute calculate yani rotayı gösteri çalıştırıyor
  showRouteBtn.addEventListener("click", () => {
    resetPolylinesToDefault();

    const origin = document.getElementById("origin").value.trim();
    const destination = document.getElementById("destination").value.trim();

    const openInMapsBtn = document.getElementById("openInMapsBtn");
    if (openInMapsBtn && origin && destination) {
      const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
      openInMapsBtn.href = mapsUrl;
      console.log("Route butonundan güncellendi:", mapsUrl);
    }

    const waitForCards = setInterval(() => {
      if (weatherContainer && weatherContainer.children.length > 0) {
        toggleMapBtn.style.display = "inline-block";
        clearInterval(waitForCards);
      }
    }, 300);
  });
});

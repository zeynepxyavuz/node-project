
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



function getWeatherIconClass(main, description = "") {
  main = main?.toLowerCase?.() || '';
  description = description?.toLowerCase?.() || '';

  if (description.includes('parçalı')) {
    return '/assets/icon/partly-cloudy.png';
  } else if (description.includes('kapalı') || description.includes('çok bulutlu')) {
    return '/assets/icon/overcast.png';
  } else if (description.includes('açık')) {
    return '/assets/icon/sun.png';
  } else if (description.includes('hafif yağmur')) {
    return '/assets/icon/drizzle.png';
  } else if (description.includes('yağmur')) {
    return '/assets/icon/heavy-rain.png';
  } else if (description.includes('kar')) {
    return '/assets/icon/snow.png';
  } else if (description.includes('fırtına') || description.includes('gök gürültülü')) {
    return '/assets/icon/thunderstorm.png';
  } else if (description.includes('sis') || description.includes('pus')) {
    return '/assets/icon/fog.png';
  } else {
    switch (main) {
      case 'clear':
        return '/assets/icon/sun.png';
      case 'clouds':
        return '/assets/icon/cloudy.png';
      case 'rain':
        return '/assets/icon/heavy-rain.png';
      case 'snow':
        return '/assets/icon/snow.png';
      case 'thunderstorm':
        return '/assets/icon/thunderstorm.png';
      case 'drizzle':
        return '/assets/icon/drizzle.png';
      case 'mist':
      case 'haze':
      case 'fog':
        return '/assets/icon/fog.png';
      default:
        return '/assets/icon/unknown.png';
    }
  }
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
  const polylines= [];

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
      // 1️⃣ ROTA ÇİZ (DirectionsRenderer ile)
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

      // 2️⃣ TIKLANABİLİR POLYLINE EKLE (aynı rota üzerinde)
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

  // 1️⃣ POLYLINE GÖRSELLERİNİ GÜNCELLE
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
            routeIndex: index,
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

    data.forEach((item, index) => {
      const date = new Date(item.estimatedTime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const weather = item.weather;
      const weatherMain = weather.weather[0].main;
      const desc = weather.weather[0].description;
      const iconPath = getWeatherIconClass(weatherMain, desc);
      const temp = weather.temp;
      const location = item.location || "Konum bilinmiyor";
      const windSpeed = typeof weather.wind_speed === 'number' ? `${Math.round(weather.wind_speed * 3.6)} km/s` : "Veri yok";

      container.innerHTML += `
        <div class="weather-card">
          <img src="${iconPath}" class="weather-icon" alt="${weatherMain}" />
          <div class="loc">
            <div><strong>${timeStr}</strong></div>
            <div><strong>${location}</strong></div>
          </div>
          <div class="temp-windspeed">
            <div class="temp"><img src="/assets/icon/sicaklik.svg" class="inline-icon" />${Math.round(temp)}°C</div>
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
        
          for (let i = 0; i < 7; i++) {
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

  container.innerHTML = '';  // Önce içeriği temizle

  data.forEach((item) => {
    const date = new Date(item.estimatedTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    const weather = item.weather;
    const weatherMain = weather.weather[0].main;
    const desc = weather.weather[0].description;
    const iconPath = getWeatherIconClass(weatherMain, desc);
    const temp = weather.temp;
    const location = item.location || "Konum bilinmiyor";
    const windSpeed = typeof weather.wind_speed === 'number' ? `${Math.round(weather.wind_speed * 3.6)} km/s` : "Veri yok";

    // Kart html'si
    const cardHTML = `
      <div class="weather-card">
        <img src="${iconPath}" class="weather-icon" alt="${weatherMain}" />
        <div class="loc">
          <div><strong>${timeStr}</strong></div>
          <div><strong>${location}</strong></div>
        </div>
        <div class="temp-windspeed">
          <div class="temp"><img src="/assets/icon/sicaklik.svg" class="inline-icon" />${Math.round(temp)}°C</div>
          <div class="wind"><img src="/assets/icon/ruzgar.svg" class="inline-icon" /> ${windSpeed}</div>
        </div>
      </div>
    `;

    container.innerHTML += cardHTML;
  });
}

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
//burda ekledin harita url
  const openInMapsBtn = document.getElementById("openInMapsBtn");

  if (mapVisible) {
    const origin = document.getElementById("origin").value;
    const destination = document.getElementById("destination").value;

    const mapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
    

    openInMapsBtn.href = mapsUrl;
    openInMapsBtn.style.display = "inline-block";

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
    //harita kapattığında butonu gizlersin
    openInMapsBtn.style.display = "none";
  }
});
 //showroute calculate yani rotayı gösteri çalıştırıyor
  showRouteBtn.addEventListener("click", () => {
  resetPolylinesToDefault();

  const waitForCards = setInterval(() => {
    if (weatherContainer && weatherContainer.children.length > 0) {
      toggleMapBtn.style.display = "inline-block";
      clearInterval(waitForCards);
     }
  }, 300);
});
});

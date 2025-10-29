document.addEventListener("DOMContentLoaded", async () => {

  // ==== KARTTA ====
  const map = L.map('map', { zoomControl: false }).setView([20.00, 0.00], 1);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  // ==== ELEMENTIT ====
  const infoBox = document.getElementById('infoBox');
  const closeBtn = document.getElementById('closeInfoButton');
  const searchInput = document.getElementById('searchInput');
  const suggestions = document.getElementById('suggestions');
  const datalist = document.getElementById('countryList');
  const verticalSlider = document.getElementById('vertical-m-slider');
  const liftSlider = document.getElementById('lift-slider');
  const runSlider = document.getElementById('run-slider');
  const liftSliderValue = document.getElementById('lift-slider-value');
  const runSliderValue = document.getElementById('run-slider-value');
  const verticalSliderValue = document.getElementById('vertical-slider-value');
  const monthCheckboxes = document.querySelectorAll('.month-checkbox');


  let selectedMarker = null;



  closeBtn.onclick = () => {
    infoBox.classList.remove('visible'); // piilota infobox

    // 🔹 Poista valittu markkeri, jos sellainen on
    if (selectedMarker) {
      map.removeLayer(selectedMarker);
      selectedMarker = null;
    }
  };

  let markers = [];
  let data = [];

  // ==== LADATAAN DATA ====
  try {
    data = await (await fetch('ski_resorts.json')).json();
  } catch (err) {
    console.error("JSON lataus epäonnistui:", err);
    return;
  }

  // 🔹 PRECOMPUTE SEASON MONTHS
  data.forEach(r => {
    const start = new Date(r.season_start).getMonth() + 1;
    const end = new Date(r.season_end).getMonth() + 1;
    const months = [];
    if (start <= end) {
      for (let m = start; m <= end; m++) months.push(m);
    } else {
      for (let m = start; m <= 12; m++) months.push(m);
      for (let m = 1; m <= end; m++) months.push(m);
    }
    r.seasonMonths = months;
  });

  // ==== MARKKERIT ====
  const markerCluster = L.markerClusterGroup({
    spiderfyOnEveryZoom: false,
    showCoverageOnHover: false,
    maxClusterRadius: 40, // pienempi = enemmän klustereita
  });

  map.addLayer(markerCluster);

  // 🔹 Luodaan markerit asynkronisesti pienissä erissä
  async function renderMarkersGradually(data, batchSize = 500) {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchMarkers = batch.map(r => createMarker(r));
      batchMarkers.forEach(m => markerCluster.addLayer(m));
      markers.push(...batchMarkers);
      await new Promise(r => setTimeout(r, 0)); // antaa selaimelle hengähdystauon
    }
    console.log("✅ Kaikki markerit lisätty:", markers.length);
  }

  // Käynnistä markkerien luonti
  renderMarkersGradually(data);


  // ==== TÄYTÄ MAAT DATALISTIIN ====
  const countries = [...new Set(data.map(r => r.country))].sort();
  datalist.innerHTML = countries.map(c => `<option value="${c}">`).join('');

  
  // ==== SLIDERIT ====
  createCustomSlider(verticalSlider, verticalSliderValue, [0, 3000], 0, 3000, 50);
  createCustomSlider(liftSlider, liftSliderValue, [0, 170], 0, 170, 1);
  createCustomSlider(runSlider, runSliderValue, [0, 170], 0, 170, 1);

  // Aja filtterit vasta, kun sliderit varmasti valmiit
  verticalSlider.noUiSlider.on('update', debounce(applyFilters, 100));
  liftSlider.noUiSlider.on('update', debounce(applyFilters, 100));
  runSlider.noUiSlider.on('update', debounce(applyFilters, 100));

  // Ensimmäinen suodatus
  applyFilters();

  // ==== FILTTERIT ====
  document.querySelectorAll('#filterBox input').forEach(el => {
    if (el.type === "checkbox") {
      el.addEventListener('change', applyFilters);
    } else {
      el.addEventListener('input', applyFilters);
    }
  });

  document.querySelectorAll('.park-condition-checkbox')
      .forEach(cb => cb.addEventListener('change', applyFilters));

  // ==== HAKU ====
  const clearButton = document.getElementById('clear-button');
  let selectedIndex = -1;

  searchInput.addEventListener('input', handleSearch);

  clearButton.addEventListener('click', () => {
    searchInput.value = '';        // Tyhjennä hakukenttä
    suggestions.innerHTML = '';    // Tyhjennä ehdotukset
    selectedIndex = -1;            // Resetoi aktiivinen valinta
    searchInput.focus();           // Vie fokus takaisin kenttään
  });

  // ==== FUNKTIOT ====
  function createCustomSlider(element, elementValue, start = [0, 100], min = 0, max = 100, step = 1, onUpdate = null) {
    noUiSlider.create(element, {
      start: start,
      connect: true,
      range: { min: min, max: max },
      step: step,
      format: {
        to: value => Math.round(value),
        from: value => Number(value)
      }
    });

    element.noUiSlider.on('update', (values) => {
      const [min, max] = values.map(v => Math.round(v));
      elementValue.textContent = `${min} – ${max}`;
    });

    /*  TOOLTIPIT
    element.noUiSlider.on('start', (values, handle) => {
      element.querySelectorAll('.noUi-handle')[handle].classList.add('noUi-active');
    });

    element.noUiSlider.on('end', (values, handle) => {
      element.querySelectorAll('.noUi-handle')[handle].classList.remove('noUi-active');
    });
    */

    // Päivitysfunktio
    if (onUpdate) {
      element.noUiSlider.on('update', onUpdate);
    }

    return element.noUiSlider;
  }

  
  function createMarker(r) {
    const marker = L.circleMarker([r.lat, r.lon], {
      radius: 5,
      color: '#0074D9',
      fillColor: '#0074D9',
      fillOpacity: 1
    });
    marker.data = r;
    marker.on('click', () => {
      showInfo(r);
      map.panTo(marker.getLatLng()); // keskittää markkerin
      highlightSelectedMarker(marker);
    });
    return marker;
  }

  function showInfo(r) {
    const byId = id => document.getElementById(id);
    byId("resort-name").textContent = r.name;
    byId("overall-description-text").textContent = r.overall_description;
    byId("season-text").textContent = `${r.season_start} – ${r.season_end}`;
    byId("height-text").textContent = `${r.vertical_m}m`;
    byId("lift-count-text").textContent = r.lift_count;
    byId("run-count-text").textContent = r.run_count;

    setDiamond("green-run-text", r.green_run, "green");
    setDiamond("blue-run-text", r.blue_run, "blue");
    setDiamond("red-run-text", r.red_run, "red");
    setDiamond("black-run-text", r.black_run, "black");

    ["s","m","l","xl"].forEach(k => setCheck(`${k}-text`, r[`${k}_park`], k.toUpperCase()));
    showStars("condition-text", r.park_condition, 3);
    ["superpipe","minipipe","moguls"].forEach(k => setCheck(`${k}-text`, r[k], k));
    byId("park-description-text").textContent = r.park_description;
    setCheck("has-transport-text", r.has_public_trans, "", false);

    infoBox.classList.add('visible');
  }

  function setDiamond(id, val, color) {
    const el = document.getElementById(id);
    el.innerHTML = val ? `<span class='diamond ${color}'>&#9670;</span> ${val}` : "";
  }

  function setCheck(id, val, label, hideFalse = true) {
    const el = document.getElementById(id);
    if (val === true) {
      el.innerHTML = `<span style="color:green">✔</span> ${label}`;
    } else if (!hideFalse && val === false) {
      el.innerHTML = `<span style="color:red">✘</span> ${label}`;
    } else {
      el.innerHTML = "";
    }
  }

  function showStars(id, value, max = 3) {
    const el = document.getElementById(id);
    if (!value) return el.textContent = "n/a";
    el.innerHTML = "";
    for (let i = 1; i <= max; i++) {
      el.innerHTML += `<span style="color:${i <= value ? 'gold' : '#ccc'}; font-size:1.2em;">${i <= value ? '★' : '☆'}</span>`;
    }
  }

  function applyFilters() {
    const country = document.getElementById('countryInput').value.trim().toLowerCase();
    const filters = ['xl_park', 'l_park','m_park','s_park','superpipe','minipipe','moguls']
      .reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id).checked }), {});
    const [minHeight, maxHeight] = getSliderRange(verticalSlider);
    const [minLift, maxLift] = getSliderRange(liftSlider);
    const [minRun, maxRun] = getSliderRange(runSlider);
    const selectedMonths = Array.from(monthCheckboxes).filter(cb=>cb.checked).map(cb=>parseInt(cb.value));
    const selectedPublicTrans = Array.from(
      document.querySelectorAll('input[id$="public-trans-checkbox"]:checked')
    ).map(cb => cb.id.charAt(0));

    // Suodatetaan näkyvät markerit
    const visibleMarkers = markers.filter(m => {
      const d = m.data;
      const matchCountry = !country || d.country?.toLowerCase().includes(country);
      const matchParks = Object.entries(filters).every(([k, v]) => !v || d[k]);
      const matchHeight = inRange(d.vertical_m ?? 0, minHeight, maxHeight);
      const matchLift = inRange(d.lift_count ?? 0, minLift, maxLift);
      const matchRun = inRange(d.run_count ?? 0, minRun, maxRun);
      const matchMonths = selectedMonths.every(mo => d.seasonMonths.includes(mo));
      const matchPublicTrans = selectedPublicTrans.length === 0 || selectedPublicTrans.includes(d.public_trans);

      const selectedConditions = Array.from(document.querySelectorAll('.park-condition-checkbox'))
                                      .filter(cb => cb.checked)
                                      .map(cb => cb.value);
      const parkCond = d.park_condition ?? 'none';
      const matchCondition = selectedConditions.length === 0 || selectedConditions.includes(String(parkCond));

      return matchCountry && matchParks && matchHeight && matchLift && matchRun && matchMonths && matchCondition && matchPublicTrans;
    });

    // 🔹 Käytä Set nopeaan tarkistukseen
    const visibleSet = new Set(visibleMarkers);

    // 🔹 Tyhjennetään ja lisätään vain näkyvät markerit
    markerCluster.clearLayers();
    visibleMarkers.forEach(m => markerCluster.addLayer(m));

    // (valinnainen) jos haluat merkitä näkyvät eri värillä:
    /*
    markers.forEach(m => {
      const isVisible = visibleSet.has(m);
      m.setStyle({ opacity: isVisible ? 1 : 0.2 });
    });
    */


  };


  function getSliderRange(slider) {
    return slider.noUiSlider.get().map(v => parseFloat(v));
  }

  function inRange(value, min, max) {
    return value >= min && value <= max;
  }



  //let tempMarker = null; // väliaikainen marker geokoodatuille paikoille

  async function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    if (!query) return;

    // 1️⃣ ENSIN etsitään resortit
    const resortMatches = markers
      .map(m => {
        const d = m.data;
        if (!d.name) return null;

        const words = d.name.toLowerCase().split(/[\s-]+/);
        const matchIndex = words.findIndex(word => word.startsWith(query));
        return matchIndex !== -1 ? { marker: m, matchIndex } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.matchIndex - b.matchIndex);

    // Lisätään resortit listaan
    resortMatches.slice(0, 10).forEach(obj => {
      const m = obj.marker;
      const d = m.data;

      const li = document.createElement('li');
      li.classList.add('list-item');
      li.innerHTML = `
        <img src="snowboarder_icon.svg" class="list-icon" alt="skiresort">
        <div>
          <span>${d.name}</span><br>
          ${d.city || d.country
            ? `<span class="subtext">${[d.city, d.country].filter(Boolean).join(', ')}</span>`
            : ''
          }
        </div>
      `;
      li.onclick = () => selectMarker(m);
      suggestions.appendChild(li);
    });

    // 3️⃣ Valitaan ensimmäinen ehdotus enterillä
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const firstItem = suggestions.querySelector('li');
        if (firstItem) {
          firstItem.click();
        } else {
          // Jos listassa ei ole ehdotuksia, voit suorittaa haun suoraan
          const exactMatch = markers.find(m => m.data.name.toLowerCase() === query);
          if (exactMatch) selectMarker(exactMatch);
        }
      }
    };

    /*
    // 2️⃣ HAETAAN MAAT JA KAUPUNGIT GEOKOODAUKSELLA
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=20`
      );
      const results = await res.json();
      if (!results.length) return;

      // Suodatetaan maat
      const countries = results.filter(r => {
        const hasCountry = !!r.address?.country;
        const isCountryType = r.type === "country" || (r.class === "boundary" && r.type === "administrative");
        const noCity = !r.address?.city && !r.address?.town && !r.address?.village;

        return hasCountry && isCountryType && noCity;
      });

      // Suodatetaan kaupungit
      const cities = results.filter(r => r.type === "city" || r.type === "town" || r.type === "village");

      const createListItem = r => {
        const li = document.createElement('li');
        li.innerHTML = `
          <p>${r.display_name.split(',')[0]}</p>
          <span class="subtext">${r.display_name}</span>
        `;
        li.onclick = () => {
          if (tempMarker) map.removeLayer(tempMarker);

          const lat = parseFloat(r.lat);
          const lon = parseFloat(r.lon);
          const zoomLevel =
            r.type === "country" ? 5 :
            r.type === "state" ? 7 :
            r.type === "city" || r.type === "town" ? 10 : 12;

          tempMarker = L.marker([lat, lon]).addTo(map)
            .bindPopup(`<strong>${r.display_name}</strong>`)
            .openPopup();

          map.setView([lat, lon], zoomLevel);
          suggestions.innerHTML = '';
        };
        return li;
      };

      // Lisätään maat ja kaupungit resorttien perään
      countries.forEach(r => suggestions.appendChild(createListItem(r)));
      //cities.forEach(r => suggestions.appendChild(createListItem(r)));

    } catch (err) {
      console.error("Geokoodaus epäonnistui:", err);
    }
      */
  }


  function selectMarker(marker) {
    suggestions.innerHTML = '';
    searchInput.value = marker.data.name;
    map.setView([marker.data.lat, marker.data.lon], 8);
    marker.fire('click');
  }

  function highlightSelectedMarker(marker) {
    // Poista edellinen valintamerkki, jos on
    if (selectedMarker) {
      map.removeLayer(selectedMarker);
    }

    // Luo oletus Leaflet-merkki (punainen)
    selectedMarker = L.marker(marker.getLatLng(), { interactive: false }).addTo(map);

    // Keskitetään kartta
    map.panTo(marker.getLatLng());
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }


});

  
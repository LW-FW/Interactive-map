import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

document.addEventListener('DOMContentLoaded', () => {
  const supabaseUrl = 'https://jdkhhywfskabkpzbizbs.supabase.co';
  const supabaseKey = 'sb_publishable_Kak7KiK11KB6OXDgzskhqw_MQiwZz-U'; // truncated for safety
  const supabase = createClient(supabaseUrl, supabaseKey);

  const loginDiv = document.getElementById('login');
  const mapDiv = document.getElementById('map');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');


  const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  // ===== BURGER MENU FUNCTIONALITY =====
const burgerIcon = document.querySelector('.burger-icon');
const menuItems = document.querySelector('.menu-items');

burgerIcon.addEventListener('click', () => {
  burgerIcon.classList.toggle('open'); // animate icon into X
  menuItems.classList.toggle('show');  // slide menu in/out
});


// Menu button event listeners
document.getElementById('menu-signout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

document.getElementById('menu-add-marker').addEventListener('click', () => {
  alert('Add Marker feature coming soon!');
});

document.getElementById('menu-delete-marker').addEventListener('click', () => {
  alert('Delete Marker feature coming soon!');
});

document.getElementById('menu-delete-file').addEventListener('click', () => {
  alert('Delete File feature coming soon!');
});

document.getElementById('menu-update-email').addEventListener('click', () => {
  alert('Update Email feature coming soon!');
});

document.getElementById('menu-update-password').addEventListener('click', () => {
  alert('Update Password feature coming soon!');
});

  let map;
  let markersLayer;

  loginBtn.addEventListener('click', loginUser);

  async function loginUser() {
    loginError.textContent = '';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
      loginError.textContent = 'Please enter email and password.';
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      loginError.textContent = error.message;
    } else {
      loginDiv.style.display = 'none';
      mapDiv.style.display = 'block';
      loadMapAndMarkers();
    }
  }

  async function loadMapAndMarkers() {
    if (!map) {
      map = L.map('map').setView([53.771317, -2.366353], 16);

      const maptilerKey = 'Eykq6rqTqPVtQktc4Pbu';
      L.tileLayer(`https://api.maptiler.com/maps/landscape/{z}/{x}/{y}.png?key=${maptilerKey}`, {
        attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: 20,
      }).addTo(map);

      markersLayer = L.layerGroup().addTo(map);
    }

    if (markersLayer) {
      markersLayer.clearLayers();
    }

    const { data: markers, error } = await supabase.from('markers').select('*');
    if (error) {
      alert('Failed to load markers: ' + error.message);
      return;
    }

    for (const marker of markers) {
      const icon = marker.active ? greenIcon : redIcon;
      const leafletMarker = L.marker([marker.lat, marker.long], { icon }).addTo(markersLayer);

      const buttonId = `toggle-${marker.id}`;
      const formId = `upload-${marker.id}`;
      const fileListId = `files-${marker.id}`;

      const filesHtml = await listFiles(marker.id);

      leafletMarker.bindPopup(`
        <b>${marker.name}</b><br/>
        Active: ${marker.active ? 'Yes' : 'No'}<br/>
        <button id="${buttonId}">Turn ${marker.active ? 'Off' : 'On'}</button>
        <hr>
        <form id="${formId}">
          <input type="file" name="files" multiple />
          <button type="submit">Upload</button>
        </form>
        <div class="file-list" id="${fileListId}">${filesHtml}</div>
      `);

      leafletMarker.on('popupopen', () => {
        const toggleBtn = document.getElementById(buttonId);
        const uploadForm = document.getElementById(formId);

        toggleBtn.onclick = async () => {
          await toggleMarker(marker.id, !marker.active);
          map.closePopup();
        };

        uploadForm.onsubmit = async (e) => {
          e.preventDefault();
          const files = uploadForm.querySelector('input[type="file"]').files;
          if (files.length === 0) return alert("No files selected.");
          await uploadFiles(marker.id, files);
          map.closePopup();
        };
      });
    }
  }

  async function toggleMarker(id, newState) {
    const { error } = await supabase.from('markers').update({ active: newState }).eq('id', id);
    if (error) alert('Failed to update marker: ' + error.message);
    else loadMapAndMarkers();
  }

  async function uploadFiles(markerId, files) {
    for (const file of files) {
      const filePath = `${markerId}/${file.name}`;
      const { error } = await supabase.storage.from('attachments').upload(filePath, file, {
        upsert: true,
      });
      if (error) {
        alert(`Error uploading ${file.name}: ${error.message}`);
      }
    }
  }

  async function listFiles(markerId) {
    const { data, error } = await supabase.storage.from('attachments').list(`${markerId}/`);
    if (error) return '<p>Error loading files</p>';
    if (!data || data.length === 0) return '<p>No files yet</p>';

    return data.map(file => {
      const url = supabase.storage.from('attachments').getPublicUrl(`${markerId}/${file.name}`).data.publicUrl;
      return `<a href="${url}" target="_blank">${file.name}</a>`;
    }).join('');
  }

  async function initApp() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      loginDiv.style.display = 'none';
      mapDiv.style.display = 'block';
      loadMapAndMarkers();
    } else {
      loginDiv.style.display = 'block';
      mapDiv.style.display = 'none';
    }
  }

  initApp();
});

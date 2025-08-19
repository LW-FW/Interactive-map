import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Utility functions for better error handling
function showError(message, element = null) {
  console.error(message);
  if (element) {
    element.textContent = message;
    element.className = 'error-message';
  } else {
    alert(message);
  }
}

function validateInput(value, type = 'text') {
  if (!value || value.trim() === '') return false;
  
  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
  
  if (type === 'number') {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }
  
  return true;
}

function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}

document.addEventListener('DOMContentLoaded', () => {
  // Supabase configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
  const supabaseUrl = 'https://jdkhhywfskabkpzbizbs.supabase.co';
  const supabaseKey = 'sb_publishable_Kak7KiK11KB6OXDgzskhqw_MQiwZz-U'; // Replace with your actual key
  
  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    showError('Failed to initialize Supabase client: ' + error.message);
    return;
  }

  // DOM Elements
  const loginDiv = document.getElementById('login');
  const mapDiv = document.getElementById('map');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const burgerMenu = document.querySelector('.burger-menu');
  
  // Initialize burger menu as hidden
  burgerMenu.style.display = 'none';
  
  // Global variables
  let currentFilter = null; // filter is null at start: no filter applied
  let map;
  let markersLayer;

  // Leaflet marker icons
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

  burgerIcon?.addEventListener('click', () => {
    burgerIcon.classList.toggle('open'); // animate icon into X
    menuItems.classList.toggle('show');  // slide menu in/out
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!burgerMenu.contains(e.target) && menuItems.classList.contains('show')) {
      burgerIcon.classList.remove('open');
      menuItems.classList.remove('show');
    }
  });

  /* ---------- BUTTON FUNCTIONALITY WITH CONFIRMATION ---------- */

  document.getElementById('menu-signout')?.addEventListener('click', async () => {
    if (confirm("Are you sure you want to sign out?")) {
      try {
        await supabase.auth.signOut();
        location.reload();
      } catch (error) {
        showError('Error signing out: ' + error.message);
      }
    }
  });

  document.getElementById('menu-add-marker')?.addEventListener('click', async () => {
    try {
      const name = prompt("Enter marker name:");
      if (!validateInput(name)) {
        showError("Please enter a valid marker name.");
        return;
      }

      const latInput = prompt("Enter latitude:");
      const longInput = prompt("Enter longitude:");
      
      if (!validateInput(latInput, 'number') || !validateInput(longInput, 'number')) {
        showError("Please enter valid latitude and longitude values.");
        return;
      }

      const lat = parseFloat(latInput);
      const long = parseFloat(longInput);
      
      // Validate coordinate bounds
      if (lat < -90 || lat > 90 || long < -180 || long > 180) {
        showError("Latitude must be between -90 and 90, longitude between -180 and 180.");
        return;
      }

      const active = confirm("Should this marker be active?");
      const sanitizedName = sanitizeInput(name);

      const { error } = await supabase.from('markers').insert([{ 
        name: sanitizedName, 
        lat, 
        long, 
        active 
      }]);
      
      if (error) throw error;
      
      alert("Marker added successfully!");
      await loadMapAndMarkers();
    } catch (error) {
      showError("Error adding marker: " + error.message);
    }
  });

  document.getElementById('menu-delete-marker')?.addEventListener('click', async () => {
    try {
      const markerName = prompt("Enter the name of the marker to delete:");
      if (!validateInput(markerName)) {
        showError("Please enter a valid marker name.");
        return;
      }

      const sanitizedName = sanitizeInput(markerName);
      
      // First, check if the marker exists
      const { data: existingMarkers, error: searchError } = await supabase
        .from('markers')
        .select('id, name')
        .eq('name', sanitizedName);
      
      if (searchError) throw searchError;
      
      if (!existingMarkers || existingMarkers.length === 0) {
        showError(`No marker found with the name "${sanitizedName}".`);
        return;
      }
      
      if (existingMarkers.length > 1) {
        showError(`Multiple markers found with the name "${sanitizedName}". Please ensure marker names are unique.`);
        return;
      }
      
      if (confirm(`Are you sure you want to delete the marker "${sanitizedName}"?`)) {
        const { error } = await supabase.from('markers').delete().eq('name', sanitizedName);
        if (error) throw error;
        
        alert("Marker deleted successfully!");
        await loadMapAndMarkers();
      }
    } catch (error) {
      showError("Error deleting marker: " + error.message);
    }
  });

  document.getElementById('menu-delete-file')?.addEventListener('click', async () => {
    try {
      const markerId = prompt("Enter the marker ID for the file:");
      const fileName = prompt("Enter the file name to delete:");

      if (!validateInput(markerId, 'number') || !validateInput(fileName)) {
        showError("Please enter valid marker ID and file name.");
        return;
      }

      if (confirm(`Delete file "${fileName}"?`)) {
        const { error } = await supabase.storage
          .from('attachments')
          .remove([`${markerId}/${sanitizeInput(fileName)}`]);
        
        if (error) throw error;
        alert("File deleted successfully!");
      }
    } catch (error) {
      showError("Error deleting file: " + error.message);
    }
  });

  document.getElementById('menu-update-email')?.addEventListener('click', async () => {
    try {
      const newEmail = prompt("Enter your new email:");
      if (!validateInput(newEmail, 'email')) {
        showError("Please enter a valid email address.");
        return;
      }
      
      if (confirm(`Update email to: ${newEmail}?`)) {
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        alert("Email updated successfully!");
      }
    } catch (error) {
      showError("Error updating email: " + error.message);
    }
  });

  document.getElementById('menu-update-password')?.addEventListener('click', async () => {
    try {
      const newPassword = prompt("Enter your new password:");
      if (!validateInput(newPassword) || newPassword.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
      }
      
      if (confirm("Change your password now?")) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        alert("Password updated successfully!");
      }
    } catch (error) {
      showError("Error updating password: " + error.message);
    }
  });

  // Login functionality
  loginBtn?.addEventListener('click', loginUser);

  // Allow Enter key to trigger login
  ['email', 'password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loginUser();
      }
    });
  });

  async function loginUser() {
    try {
      loginError.textContent = '';
      loginError.className = '';
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      if (!validateInput(email, 'email') || !validateInput(password)) {
        showError('Please enter a valid email and password.', loginError);
        return;
      }

      // Show loading state
      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      // Success - show map
      loginDiv.style.display = 'none';
      mapDiv.style.display = 'block';
      burgerMenu.style.display = 'block';
      await loadMapAndMarkers();
    } catch (error) {
      showError(error.message, loginError);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  }

  async function loadMapAndMarkers() {
    try {
      if (!map) {
        map = L.map('map').setView([53.771317, -2.366353], 16);

        const maptilerKey = 'Eykq6rqTqPVtQktc4Pbu';
        L.tileLayer(`https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.png?key=${maptilerKey}`, {
          attribution: '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);

        // Attach filter toggle listeners after map is created
        document.querySelectorAll('.toggle-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // Toggle active class
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));

            // If already active, unselect filter (null)
            if (isActive) {
              currentFilter = null;
            } else {
              btn.classList.add('active');
              currentFilter = btn.dataset.filter === 'all' ? null : btn.dataset.filter;
            }
            loadMapAndMarkers();
          });
        });
      }

      if (markersLayer) {
        markersLayer.clearLayers();
      }

      // Build query based on current filter
      let query = supabase.from('markers').select('*');
      if (currentFilter === 'on') {
        query = query.eq('active', true);
      } else if (currentFilter === 'off') {
        query = query.eq('active', false);
      }
      // if currentFilter is null => no filter applied, show all

      const { data: markers, error } = await query;
      if (error) throw error;

      if (!markers) return;

      // Add markers to map
      for (const marker of markers) {
        const icon = marker.active ? greenIcon : redIcon;
        const leafletMarker = L.marker([marker.lat, marker.long], { icon }).addTo(markersLayer);

        const buttonId = `toggle-${marker.id}`;
        const formId = `upload-${marker.id}`;
        const fileListId = `files-${marker.id}`;

        const filesHtml = await listFiles(marker.id);

        leafletMarker.bindPopup(`
          <div class="popup-content">
            <b class="popup-name">${marker.name}</b><br/>
            <span class="popup-active">
              Active: <span class="status ${marker.active ? 'active' : 'inactive'}">${marker.active ? 'Yes' : 'No'}</span>
            </span><br/>
            <button id="${buttonId}" class="popup-toggle-btn">Turn ${marker.active ? 'Off' : 'On'}</button>
            <br><br>
            <hr>  
            <div class="file-list" id="${fileListId}">${filesHtml}</div>
            <hr>
            <form id="${formId}">
              <input type="file" name="files" multiple />
              <button type="submit">Upload</button>
            </form>
          </div>
        `);

        leafletMarker.on('popupopen', () => {
          const toggleBtn = document.getElementById(buttonId);
          const uploadForm = document.getElementById(formId);

          toggleBtn.onclick = async () => {
            try {
              await toggleMarker(marker.id, !marker.active);
              map.closePopup();
            } catch (error) {
              showError('Failed to toggle marker: ' + error.message);
            }
          };

          uploadForm.onsubmit = async (e) => {
            e.preventDefault();
            try {
              const files = uploadForm.querySelector('input[type="file"]').files;
              if (files.length === 0) {
                alert("No files selected.");
                return;
              }
              await uploadFiles(marker.id, files);
              map.closePopup();
            } catch (error) {
              showError('Failed to upload files: ' + error.message);
            }
          };
        });
      }
    } catch (error) {
      showError('Failed to load markers: ' + error.message);
    }
  }

  async function toggleMarker(id, newState) {
    const { error } = await supabase.from('markers').update({ active: newState }).eq('id', id);
    if (error) throw error;
    await loadMapAndMarkers();
  }

  async function uploadFiles(markerId, files) {
    for (const file of files) {
      const filePath = `${markerId}/${file.name}`;
      const { error } = await supabase.storage.from('attachments').upload(filePath, file, {
        upsert: true,
      });
      if (error) {
        throw new Error(`Error uploading ${file.name}: ${error.message}`);
      }
    }
  }

  async function listFiles(markerId) {
    try {
      const { data, error } = await supabase.storage.from('attachments').list(`${markerId}/`);
      if (error) throw error;
      if (!data || data.length === 0) return '<p>No files yet</p>';

      return data.map(file => {
        const url = supabase.storage.from('attachments').getPublicUrl(`${markerId}/${file.name}`).data.publicUrl;
        return `<a href="${url}" target="_blank">${file.name}</a>`;
      }).join('<br>');
    } catch (error) {
      return '<p>Error loading files</p>';
    }
  }

  async function initApp() {
    try {
      const devBypass = false; // Set to true to skip login and load map immediately for dev
      if (devBypass) {
        loginDiv.style.display = 'none';
        mapDiv.style.display = 'block';
        burgerMenu.style.display = 'block';
        await loadMapAndMarkers();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        loginDiv.style.display = 'none';
        mapDiv.style.display = 'block';
        burgerMenu.style.display = 'block';
        await loadMapAndMarkers();
      } else {
        loginDiv.style.display = 'block';
        mapDiv.style.display = 'none';
        burgerMenu.style.display = 'none';
      }
    } catch (error) {
      showError('Failed to initialize app: ' + error.message);
    }
  }

  // Initialize the app
  initApp();
});
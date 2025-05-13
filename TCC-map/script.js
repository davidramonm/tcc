// Variáveis globais
let map;
let usuarioLogado;
let locations = [];
let clickedPosition = null;
let clickMarker = null;
let selectedRating = 0;

// Inicialização do mapa quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
  // Verificar autenticação
  usuarioLogado = JSON.parse(localStorage.getItem('usuarioLogado'));
  if (!usuarioLogado) {
    window.location.href = 'index.html';
    return;
  }

  // Inicializar mapa
  initMap();
  
  // Carregar locais
  loadLocations();
  
  // Configurar eventos
  setupEventListeners();
});

// Inicializa o mapa Leaflet
function initMap() {
  // Coordenadas padrão
  const defaultCoords = [-23.52437655664778, -47.46314621710714];
  
  // Criar mapa
  map = L.map('map').setView(defaultCoords, 16);
  
  // Adicionar camada do OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Adicionar evento de clique no mapa
  map.on('click', onMapClick);
  
  // Mostrar mensagem de instrução
  showInstruction('Clique no mapa para selecionar a localização');
}

// Carrega locais do localStorage
function loadLocations() {
  const savedLocations = localStorage.getItem('locations');
  if (savedLocations) {
    locations = JSON.parse(savedLocations);
    updateMapMarkers();
  }
}

// Configura os event listeners
function setupEventListeners() {
  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);
  
  // Formulário de local
  document.getElementById('location-form').addEventListener('submit', saveLocation);
  
  // Estrelas de avaliação
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = parseInt(this.getAttribute('data-value'));
      updateStars();
    });
  });
  
  // Filtro de locais
  document.getElementById('location-filter').addEventListener('input', filterLocations);
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);
}

// Evento de clique no mapa
function onMapClick(e) {
  // Remove marcador anterior se existir
  if (clickMarker) {
    map.removeLayer(clickMarker);
  }
  
  // Armazena a posição clicada
  clickedPosition = e.latlng;
  
  // Cria um marcador temporário
  clickMarker = L.marker(clickedPosition, {
    icon: L.divIcon({
      className: 'click-marker',
      html: '<i class="fas fa-map-marker-alt"></i>',
      iconSize: [30, 30],
      iconAnchor: [15, 30]
    })
  }).addTo(map);
  
  // Preenche o campo de endereço com as coordenadas
  document.getElementById('location-address').value = 
    `Lat: ${clickedPosition.lat.toFixed(6)}, Lng: ${clickedPosition.lng.toFixed(6)}`;
  
  // Esconde a mensagem de instrução
  hideInstruction();
}

// Salva um novo local
async function saveLocation(e) {
  e.preventDefault();
  
  // Validação
  if (!clickedPosition) {
    showError('Por favor, selecione uma localização no mapa');
    return;
  }
  
  const name = document.getElementById('location-name').value.trim();
  if (!name) {
    showError('Por favor, informe o nome do local');
    return;
  }
  
  const type = document.getElementById('location-type').value;
  if (!type) {
    showError('Por favor, selecione o tipo de acessibilidade');
    return;
  }
  
  // Cria o objeto do local
  const newLocation = {
    id: Date.now().toString(),
    name,
    address: document.getElementById('location-address').value,
    type,
    description: document.getElementById('location-description').value,
    rating: selectedRating,
    lat: clickedPosition.lat,
    lng: clickedPosition.lng,
    user: {
      id: usuarioLogado.id,
      name: usuarioLogado.nome
    },
    date: new Date().toISOString()
  };
  
  // Processa a foto se foi enviada
  const photoInput = document.getElementById('location-photo');
  if (photoInput.files.length > 0) {
    try {
      newLocation.photo = await readFileAsBase64(photoInput.files[0]);
    } catch (error) {
      console.error('Erro ao processar foto:', error);
    }
  }
  
  // Adiciona ao array de locais
  locations.push(newLocation);
  
  // Salva no localStorage
  localStorage.setItem('locations', JSON.stringify(locations));
  
  // Atualiza a interface
  updateMapMarkers();
  updateLocationsList();
  
  // Limpa o formulário
  document.getElementById('location-form').reset();
  selectedRating = 0;
  updateStars();
  
  // Remove o marcador temporário
  if (clickMarker) {
    map.removeLayer(clickMarker);
    clickMarker = null;
  }
  clickedPosition = null;
  
  // Mostra mensagem de sucesso
  showSuccess('Local adicionado com sucesso!');
}

// Atualiza os marcadores no mapa
function updateMapMarkers() {
  // Remove todos os marcadores existentes
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  
  // Adiciona os marcadores dos locais
  locations.forEach(location => {
    const marker = L.marker([location.lat, location.lng]).addTo(map);
    
    // Popup com informações do local
    let popupContent = `<b>${location.name}</b><br>`;
    popupContent += `<small>${location.address}</small><br>`;
    popupContent += `<div>Tipo: ${getLocationTypeName(location.type)}</div>`;
    
    if (location.rating) {
      popupContent += `<div>Avaliação: ${'★'.repeat(location.rating)}${'☆'.repeat(5 - location.rating)}</div>`;
    }
    
    if (location.description) {
      popupContent += `<div>${location.description}</div>`;
    }
    
    if (location.photo) {
      popupContent += `<img src="${location.photo}" style="max-width:100%;max-height:150px;margin-top:10px;">`;
    }
    
    marker.bindPopup(popupContent);
  });
}

// Atualiza a lista de locais na sidebar
function updateLocationsList() {
  const filterText = document.getElementById('location-filter').value.toLowerCase();
  const filteredLocations = locations.filter(location => 
    location.name.toLowerCase().includes(filterText) || 
    location.address.toLowerCase().includes(filterText)
  );
  
  const container = document.getElementById('locations-container');
  container.innerHTML = '';
  
  if (filteredLocations.length === 0) {
    container.innerHTML = '<p>Nenhum local encontrado</p>';
    return;
  }
  
  filteredLocations.forEach(location => {
    const item = document.createElement('div');
    item.className = 'location-item';
    item.innerHTML = `
      <div class="location-name">${location.name}</div>
      <div class="location-address">${location.address}</div>
      <div><small>${getLocationTypeName(location.type)}</small></div>
      ${location.rating ? `<div>${'★'.repeat(location.rating)}${'☆'.repeat(5 - location.rating)}</div>` : ''}
    `;
    
    item.addEventListener('click', () => {
      map.flyTo([location.lat, location.lng], 16);
    });
    
    container.appendChild(item);
  });
}

// Filtra os locais
function filterLocations() {
  updateLocationsList();
}

// Atualiza as estrelas de avaliação
function updateStars() {
  document.querySelectorAll('.star').forEach((star, index) => {
    star.textContent = index < selectedRating ? '★' : '☆';
    star.className = `star ${index < selectedRating ? 'active' : ''}`;
  });
}

// Toggle da sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// Mostra mensagem de instrução
function showInstruction(message) {
  const elem = document.createElement('div');
  elem.id = 'instruction-message';
  elem.className = 'instruction-message';
  elem.textContent = message;
  document.body.appendChild(elem);
  
  setTimeout(() => {
    elem.style.display = 'block';
  }, 500);
  
  setTimeout(() => {
    elem.style.opacity = '0';
    setTimeout(() => elem.remove(), 500);
  }, 5000);
}

// Esconde mensagem de instrução
function hideInstruction() {
  const elem = document.getElementById('instruction-message');
  if (elem) {
    elem.remove();
  }
}

// Mostra mensagem de erro
function showError(message) {
  alert(message);
}

// Mostra mensagem de sucesso
function showSuccess(message) {
  alert(message);
}

// Converte tipo de local para nome amigável
function getLocationTypeName(type) {
  const types = {
    'rampa': 'Rampa de acesso',
    'banheiro': 'Banheiro adaptado',
    'elevador': 'Elevador acessível',
    'piso': 'Piso tátil',
    'sinalizacao': 'Sinalização tátil',
    'corrimao': 'Corrimão',
    'vagas': 'Vagas especiais',
    'audio': 'Sinalização sonora',
    'braille': 'Sinalização em Braille',
    'circulacao': 'Espaço para circulação'
  };
  return types[type] || type;
}

// Lê arquivo como base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Logout
function logout() {
  localStorage.removeItem('usuarioLogado');
  window.location.href = 'index.html';
}
// DevPanel Test App - Interactive Frontend Client Logic

const getBackendUrl = () => {
  const path = window.location.pathname;
  // If hosted under DevPanel path routing: /app/<project>/<service>/ or /app/<project>/
  if (path.includes('/app/')) {
    const parts = path.split('/app/')[1].split('/').filter(Boolean);
    const projectName = parts[0];
    return `${window.location.origin}/app/${projectName}/backend`;
  }
  // If running locally on standalone dev ports (3000/5500)
  if (window.location.port === '3000' || window.location.port === '5500') {
    return 'http://localhost:8080';
  }
  return 'http://localhost:8080';
};

const BACKEND_URL = getBackendUrl();

// DOM Elements
const indicatorFrontend = document.getElementById('indicator-frontend');
const indicatorBackend = document.getElementById('indicator-backend');
const indicatorDatabase = document.getElementById('indicator-database');
const indicatorRedis = document.getElementById('indicator-redis');

const backendHealthText = document.getElementById('backend-health-text');
const dbConnText = document.getElementById('db-conn-text');
const redisConnText = document.getElementById('redis-conn-text');

const btnRefreshStatus = document.getElementById('btn-refresh-status');
const btnTestCache = document.getElementById('btn-test-cache');
const btnPingHealth = document.getElementById('btn-ping-health');

const jsonResponseViewer = document.getElementById('json-response-viewer');
const notesListContainer = document.getElementById('notes-list-container');
const notesCountBadge = document.getElementById('notes-count-badge');
const formCreateNote = document.getElementById('form-create-note');

const inputTitle = document.getElementById('input-note-title');
const inputCategory = document.getElementById('input-note-category');
const inputContent = document.getElementById('input-note-content');

// Helper to log formatted JSON into diagnostics panel
function displayJson(data) {
  if (jsonResponseViewer) {
    jsonResponseViewer.textContent = JSON.stringify(data, null, 2);
  }
}

// Fetch Backend Health Diagnostic
async function fetchHealthDiagnostics() {
  indicatorFrontend.classList.add('active');

  try {
    const res = await fetch(`${BACKEND_URL}/api/health`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    
    const data = await res.json();
    displayJson(data);

    // Update Backend Indicator
    indicatorBackend.className = 'status-indicator active';
    backendHealthText.textContent = 'ONLINE (Port 8080)';
    backendHealthText.style.color = '#34d399';

    // Update DB Indicator
    if (data.services && data.services.database.includes('CONNECTED')) {
      indicatorDatabase.className = 'status-indicator active';
      dbConnText.textContent = 'Active (PostgreSQL)';
      dbConnText.style.color = '#34d399';
    } else {
      indicatorDatabase.className = 'status-indicator';
      dbConnText.textContent = 'Disconnected (Mock Mode)';
      dbConnText.style.color = '#f59e0b';
    }

    // Update Redis Indicator
    if (data.services && data.services.redis.includes('CONNECTED')) {
      indicatorRedis.className = 'status-indicator active';
      redisConnText.textContent = 'Active (Redis 7)';
      redisConnText.style.color = '#34d399';
    } else {
      indicatorRedis.className = 'status-indicator';
      redisConnText.textContent = 'Disconnected (Mock Mode)';
      redisConnText.style.color = '#f59e0b';
    }

  } catch (err) {
    console.error('Backend fetch error:', err);
    indicatorBackend.className = 'status-indicator error';
    backendHealthText.textContent = 'UNREACHABLE';
    backendHealthText.style.color = '#ef4444';

    indicatorDatabase.className = 'status-indicator error';
    dbConnText.textContent = 'UNREACHABLE';
    dbConnText.style.color = '#ef4444';

    indicatorRedis.className = 'status-indicator error';
    redisConnText.textContent = 'UNREACHABLE';
    redisConnText.style.color = '#ef4444';

    displayJson({ error: err.message, backendUrl: BACKEND_URL, hint: 'Ensure devpanel.yaml backend container is running on port 8080.' });
  }
}

// Fetch Notes List from PostgreSQL/Backend API
async function loadNotes() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/notes`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    
    const data = await res.json();
    const notes = data.notes || [];

    notesCountBadge.textContent = `${notes.length} item${notes.length === 1 ? '' : 's'} (${data.source || 'db'})`;

    if (notes.length === 0) {
      notesListContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; text-align: center;">No notes found. Create your first note above!</div>';
      return;
    }

    notesListContainer.innerHTML = notes.map(note => `
      <div class="note-item" id="note-card-${note.id}">
        <div class="note-main">
          <h4>${escapeHtml(note.title)} <span class="note-tag">${escapeHtml(note.category || 'General')}</span></h4>
          <p class="note-content">${escapeHtml(note.content)}</p>
        </div>
        <button class="btn-delete-note" onclick="deleteNote(${note.id})" title="Delete record">🗑️</button>
      </div>
    `).join('');

  } catch (err) {
    notesListContainer.innerHTML = `<div style="color: var(--danger); font-size: 0.85rem; padding: 12px;">Failed to load notes from API: ${err.message}</div>`;
  }
}

// Submit New Note
formCreateNote.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    title: inputTitle.value.trim(),
    category: inputCategory.value.trim() || 'General',
    content: inputContent.value.trim()
  };

  try {
    const res = await fetch(`${BACKEND_URL}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    displayJson(data);

    // Reset Form & Reload List
    inputTitle.value = '';
    inputContent.value = '';
    loadNotes();

  } catch (err) {
    alert(`Failed to save note: ${err.message}`);
  }
});

// Delete Note
async function deleteNote(id) {
  if (!confirm(`Delete note ID #${id}?`)) return;

  try {
    const res = await fetch(`${BACKEND_URL}/api/notes/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    displayJson(data);
    loadNotes();
  } catch (err) {
    alert(`Failed to delete note: ${err.message}`);
  }
}

// Test Redis Cache Ping
async function testRedisCache() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/cache-test`);
    const data = await res.json();
    displayJson(data);
  } catch (err) {
    displayJson({ error: err.message });
  }
}

// Helper: XSS Protection
function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Event Listeners
btnRefreshStatus.addEventListener('click', () => {
  fetchHealthDiagnostics();
  loadNotes();
});

btnTestCache.addEventListener('click', testRedisCache);
btnPingHealth.addEventListener('click', fetchHealthDiagnostics);

// Initial Load
fetchHealthDiagnostics();
loadNotes();

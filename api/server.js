const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// In-memory fallback cache/store for standalone dev mode without DB
const mockNotes = [
  {
    id: 1,
    title: 'Standalone Fallback Note',
    content: 'Running in isolated mock mode. Connect PostgreSQL via devpanel.yaml to persist live data!',
    category: 'System',
    created_at: new Date().toISOString()
  }
];

// --- PostgreSQL Database Setup ---
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres_password',
  database: process.env.DB_NAME || 'appdb',
  connectionTimeoutMillis: 3000,
};

let dbPool = null;
let isDbConnected = false;

async function initPostgres() {
  try {
    dbPool = new Pool(dbConfig);
    const client = await dbPool.connect();
    console.log(`[Database] Connected to PostgreSQL at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    isDbConnected = true;

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed sample entry if empty
    const res = await client.query('SELECT COUNT(*) FROM notes');
    if (parseInt(res.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO notes (title, content, category)
        VALUES 
          ('DevPanel Live Connection', 'PostgreSQL database container is running and active!', 'Deployment'),
          ('Architecture Verification', 'Frontend static app communicating with Node.js backend & PostgreSQL DB.', 'System');
      `);
    }
    client.release();
  } catch (err) {
    console.warn(`[Database Warning] Could not connect to PostgreSQL (${err.message}). Using fallback mode.`);
    isDbConnected = false;
  }
}

// --- Redis Cache Setup ---
let redisClient = null;
let isRedisConnected = false;

async function initRedis() {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || 6379;
  
  try {
    redisClient = createClient({
      url: `redis://${redisHost}:${redisPort}`,
      socket: { connectTimeout: 3000 }
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
    });

    await redisClient.connect();
    isRedisConnected = true;
    console.log(`[Redis Cache] Connected to Redis at ${redisHost}:${redisPort}`);
  } catch (err) {
    console.warn(`[Redis Warning] Redis unavailable (${err.message}). Cache features operating in mock mode.`);
    isRedisConnected = false;
  }
}

// Initialize Connections
initPostgres();
initRedis();

// --- API Endpoints ---

// System Root Endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'DevPanel Backend REST API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// Health & Microservice Diagnostics
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: {
      port: PORT,
      dbHost: process.env.DB_HOST || 'localhost (default)',
      dbPort: process.env.DB_PORT || '5432',
      redisHost: process.env.REDIS_HOST || 'localhost (default)',
      nodeEnv: process.env.NODE_ENV || 'development'
    },
    services: {
      database: isDbConnected ? 'CONNECTED (PostgreSQL)' : 'DISCONNECTED (Mock Mode)',
      redis: isRedisConnected ? 'CONNECTED (Redis)' : 'DISCONNECTED (Mock Mode)'
    }
  });
});

// Database CRUD: GET all notes
app.get('/api/notes', async (req, res) => {
  if (isDbConnected && dbPool) {
    try {
      const result = await dbPool.query('SELECT * FROM notes ORDER BY id DESC');
      return res.json({ source: 'postgresql', notes: result.rows });
    } catch (err) {
      console.error('Database query error:', err);
    }
  }

  // Fallback if DB is disconnected
  return res.json({ source: 'mock_memory', notes: mockNotes });
});

// Database CRUD: POST create note
app.post('/api/notes', async (req, res) => {
  const { title, content, category } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required fields.' });
  }

  const cat = category || 'General';

  if (isDbConnected && dbPool) {
    try {
      const result = await dbPool.query(
        'INSERT INTO notes (title, content, category) VALUES ($1, $2, $3) RETURNING *',
        [title, content, cat]
      );
      return res.status(201).json({ source: 'postgresql', note: result.rows[0] });
    } catch (err) {
      console.error('Database insert error:', err);
      return res.status(500).json({ error: 'Failed to insert note to database.' });
    }
  }

  // Fallback insertion
  const newNote = {
    id: mockNotes.length + 1,
    title,
    content,
    category: cat,
    created_at: new Date().toISOString()
  };
  mockNotes.unshift(newNote);
  return res.status(201).json({ source: 'mock_memory', note: newNote });
});

// Database CRUD: DELETE note
app.delete('/api/notes/:id', async (req, res) => {
  const id = parseInt(req.params.id);

  if (isDbConnected && dbPool) {
    try {
      await dbPool.query('DELETE FROM notes WHERE id = $1', [id]);
      return res.json({ success: true, message: `Note ${id} deleted from database.` });
    } catch (err) {
      console.error('Database delete error:', err);
      return res.status(500).json({ error: 'Failed to delete note from database.' });
    }
  }

  const index = mockNotes.findIndex(n => n.id === id);
  if (index !== -1) {
    mockNotes.splice(index, 1);
  }
  return res.json({ success: true, message: `Note ${id} removed from mock memory.` });
});

// Redis Cache Diagnostic Test Endpoint
app.get('/api/cache-test', async (req, res) => {
  const testKey = 'devpanel_ping_timestamp';
  const now = new Date().toISOString();

  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(testKey, now, { EX: 60 });
      const cachedVal = await redisClient.get(testKey);
      return res.json({
        status: 'success',
        engine: 'Redis',
        storedKey: testKey,
        value: cachedVal,
        ttlSeconds: 60
      });
    } catch (err) {
      console.error('Redis test error:', err);
    }
  }

  return res.json({
    status: 'mock',
    engine: 'In-Memory Mock Cache',
    storedKey: testKey,
    value: now,
    ttlSeconds: 60
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 DevPanel Backend REST API listening on port ${PORT}`);
  console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
  console.log(`==================================================`);
});

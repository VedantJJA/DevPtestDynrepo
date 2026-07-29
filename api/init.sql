-- DevPanel Test App Database Schema

CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial test entries if table is empty
INSERT INTO notes (title, content, category)
SELECT 'DevPanel Deployment Verification', 'This note confirms that the PostgreSQL database container is successfully initialized, networked, and communicating with the Node.js backend!', 'System'
WHERE NOT EXISTS (SELECT 1 FROM notes);

INSERT INTO notes (title, content, category)
SELECT 'Microservices Architecture', 'Frontend static app connected to Node.js backend, backed by PostgreSQL DB and Redis cache.', 'Architecture'
WHERE NOT EXISTS (SELECT 1 FROM notes WHERE title = 'Microservices Architecture');

# DevPanel PaaS Test Application (`devpanel.yaml`)

This repository contains a full multi-tier test application structured according to the **DevPanel 1.0 Infrastructure Specification** (`devpanel.yaml`).

## Architecture & Service Topology

The project is structured as a monorepo with 4 services configured exclusively in `devpanel.yaml`:

```
devpanel-test-app/
├── devpanel.yaml             # Declarative DevPanel infrastructure configuration
├── README.md                 # Documentation
├── web/                      # [Service: frontend] (type: static)
│   ├── index.html            # Dark glassmorphism dashboard UI
│   ├── style.css             # Custom design system & animations
│   ├── app.js                # Dynamic API diagnostic & CRUD client logic
│   └── package.json          # Node static build configuration
└── api/                      # [Service: backend] (type: web)
    ├── server.js             # Node.js Express REST API & health checks
    ├── Dockerfile            # Container build specification
    ├── init.sql              # PostgreSQL initial database schema
    └── package.json          # Express, pg, redis dependencies
```

---

## Service Breakdown in `devpanel.yaml`

| Service | Type | Directory / Image | Port / Output | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`frontend`** | `static` | `web/` | `dist/` | Compiled client-side Single Page Application served via Nginx. |
| **`backend`** | `web` | `api/` | `8080` | Express REST API handling CORS, health diagnostics, database CRUD, and Redis caching. |
| **`database`** | `database` | `postgres:15-alpine` | `5432` | Relational database with persistent volume `pg_data` mounted to `/var/lib/postgresql/data`. |
| **`redis-cache`**| `database` | `redis:7-alpine` | `6379` | In-memory key-value cache store. |

---

## Deployment & Subpath / Domain Routing

### 1. Default Subpath Access
Once deployed on DevPanel, the application dashboard is immediately accessible at:
$$\text{http://140.245.116.79/app/devpanel-test-app/}$$

### 2. Custom Domain Access (Automatic HTTPS)
When configured with custom domains in `devpanel.yaml`:
$$\text{https://testapp.devpanel.local/}$$

---

## DevPanel Specification (`devpanel.yaml`)

```yaml
version: "1.0"
project: "devpanel-test-app"

services:
  frontend:
    type: static
    source:
      directory: "web"
    build:
      engine: "node"
      command: "npm install && npm run build"
      output_dir: "dist"
    domains:
      - "testapp.devpanel.local"

  backend:
    type: web
    source:
      directory: "api"
    build:
      engine: "dockerfile"
      dockerfile_path: "Dockerfile"
    deploy:
      port: 8080
      command: "npm start"
    resources:
      cpu_limit: "1.0"
      mem_limit: "512m"
    env:
      - key: PORT
        value: "8080"
      - key: DB_HOST
        value: "database"
      - key: DB_PORT
        value: "5432"
      - key: DB_USER
        value: "postgres"
      - key: DB_PASS
        secret: "postgres_password"
      - key: DB_NAME
        value: "appdb"
      - key: REDIS_HOST
        value: "redis-cache"
      - key: REDIS_PORT
        value: "6379"

  database:
    type: database
    image: "postgres:15-alpine"
    deploy:
      port: 5432
    volumes:
      - name: "pg_data"
        mount_path: "/var/lib/postgresql/data"
    env:
      - key: POSTGRES_DB
        value: "appdb"
      - key: POSTGRES_USER
        value: "postgres"
      - key: POSTGRES_PASSWORD
        secret: "postgres_password"

  redis-cache:
    type: database
    image: "redis:7-alpine"
    deploy:
      port: 6379
```

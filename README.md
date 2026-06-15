## Prerequisites

- Node.js 20+ · Python 3.11+ · Docker Desktop · Git

---

## First-time setup

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/aitasker.git
cd aitasker

cd backend && npm install && cd ..
cd frontend && npm install && cd ..

cd ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 2. Environment files

```bash
cp backend\.env.example backend\.env
cp ai-service\.env.example ai-service\.env
```

Fill in `backend\.env`:
- `DATABASE_URL` — pooled Neon connection string
- `DIRECT_URL` — direct Neon connection string
- `JWT_SECRET` — run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

Fill in `ai-service\.env`:
- `ANTHROPIC_API_KEY` — your Anthropic API key

### 3. Generate Prisma client

```bash
cd backend
npx prisma generate
cd ..
```

---

## Run locally 

Open three terminals:

**Terminal 1 — Backend**
```bash
cd backend
npm run start:dev
```
→ http://localhost:3001 · Swagger at http://localhost:3001/api

**Terminal 2 — AI Service**
```bash
cd ai-service
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
→ http://localhost:8000/docs

**Terminal 3 — Frontend**
```bash
cd frontend
npm run dev
```
→ http://localhost:5173

---

## Run with Docker

```bash
docker compose up --build -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:3001/api |
| AI Service | http://localhost:8000/docs |

```bash
# Logs
docker compose logs -f

# Stop
docker compose down
```

---

## Database (Neon)

Already set up — tables and seed data are live on the shared Neon project.  
Get connection strings and put in `backend\.env`.

```bash
# Generate Prisma client (run once after cloning, and after any schema.prisma change)
cd backend && npx prisma generate

# Inspect live data in a browser UI
npx prisma studio
```
@echo off
set "ROOT=%~dp0"

start "AITasker - Backend"    cmd /k "cd /d "%ROOT%backend" && (if exist tsconfig.build.tsbuildinfo del tsconfig.build.tsbuildinfo) && npm install && npx prisma migrate deploy && npx prisma generate && npm run start:dev"
start "AITasker - Frontend"   cmd /k "cd /d "%ROOT%frontend" && npm install && npm run dev"
start "AITasker - AI Service" cmd /k "cd /d "%ROOT%ai-service" && (if not exist venv python -m venv venv) && call venv\Scripts\activate.bat && pip install -r requirements.txt -q && uvicorn app.main:app --reload --port 8000"

@echo off
echo Starting AITasker Platform...

:: Change working directory to the location of this script
cd /d "%~dp0"

:: Start Backend
echo Starting Backend...
start "AITasker - Backend" cmd /k "cd backend && npm install && npx prisma generate && npm run start:dev"

:: Start Frontend
echo Starting Frontend...
start "AITasker - Frontend" cmd /k "cd frontend && npm install && npm run dev"

:: Start AI Service
echo Starting AI Service...
start "AITasker - AI Service" cmd /k "cd ai-service && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"

echo All services are starting up in separate windows!
echo You can close this window now.

**Backend**:

```bash
cd backend
npm install          
npx prisma generate  
npm run start:dev    
```

**Frontend**:

```bash
cd frontend
npm install          
npm run dev        
```

**AI Service**`:

```bash
cd ai-service
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   
uvicorn app.main:app --reload --port 8000
```

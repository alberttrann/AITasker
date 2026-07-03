from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import elicitation, portfolio, matching, disputes, criteria, service_gen, artifact_b

app = FastAPI(
    title="AITasker LLM Service",
    description="Internal LLM microservice — called exclusively by NestJS backend.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(elicitation.router,  prefix="/llm/elicitation", tags=["Elicitation"])
app.include_router(portfolio.router,    prefix="/llm",             tags=["Portfolio"])
app.include_router(matching.router,     prefix="/llm",             tags=["Matching"])
app.include_router(disputes.router,     prefix="/llm",             tags=["Disputes"])
app.include_router(criteria.router,     prefix="/llm",             tags=["Criteria"])
app.include_router(service_gen.router,  prefix="/llm",             tags=["Service Generator"])
app.include_router(artifact_b.router,   prefix="/projects",        tags=["Artifact B"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "aitasker-llm"}
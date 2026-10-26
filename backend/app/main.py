import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

load_dotenv()

app = FastAPI(
    title="PDF2CSV AI — Hybrid SaaS API",
    description=(
        "Backend API for extracting structured tables from digital and scanned PDFs "
        "using pdfplumber (Fast mode) and Google Gemini Flash (AI Smart mode), "
        "with Excel-ready CSV export (UTF-8 with BOM & Windows-1251)."
    ),
    version="1.0.0",
)

# Configure CORS for Vercel deployments, local Vite dev servers, and Chrome Extension (chrome-extension://*)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^(https://.*\.vercel\.app|chrome-extension://.*|http://localhost:\d+|http://127\.0\.0\.1:\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-CSV-Encoding", "X-CSV-Delimiter"],
)

app.include_router(api_router, prefix="/api/v1", tags=["PDF2CSV v1"])
app.include_router(api_router, prefix="/v1", include_in_schema=False)
app.include_router(api_router, prefix="", include_in_schema=False)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "pdf-to-csv-pro-backend"}

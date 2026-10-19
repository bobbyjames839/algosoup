from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import CORS_ORIGINS
from .routers import appointments, assistant, auth, messages, patients, portal

app = FastAPI(title="GlucoCare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(messages.router)
app.include_router(assistant.router)
app.include_router(portal.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# In production the built frontend is served from here; unknown paths fall back to index.html for client-side routing.
DIST_DIR = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if DIST_DIR.is_dir():

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        file = (DIST_DIR / path).resolve()
        if file.is_file() and file.is_relative_to(DIST_DIR):
            return FileResponse(file)
        return FileResponse(DIST_DIR / "index.html")

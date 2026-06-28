import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database.mongodb import connect_db, close_db
from app.api.students import router as student_router
from app.api.courses import router as course_router
from app.api.analytics import router as analytics_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: establish connection to MongoDB
    await connect_db()
    yield
    # Shutdown logic: clean up MongoDB connection
    await close_db()

app = FastAPI(
    title="EduAgent Academic Analytics Platform API",
    version="1.0.0",
    lifespan=lifespan
)

# Health check route
@app.get("/")
async def health_check():
    """
    Service health check endpoint.
    """
    return {
        "status": "healthy",
        "message": "Welcome to the EduAgent Academic Analytics Platform API",
        "docs_url": "/docs"
    }

# Include Routers
app.include_router(student_router)
app.include_router(course_router)
app.include_router(analytics_router)

if __name__ == "__main__":
    # Start uvicorn server on port 8000 when running this file directly
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

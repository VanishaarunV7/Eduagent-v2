from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/")
async def get_analytics():
    return {"message": "Analytics endpoint skeleton"}

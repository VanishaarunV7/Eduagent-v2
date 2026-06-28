from fastapi import APIRouter, HTTPException, status
from typing import List
from app.schemas.student import StudentSchema
from app.services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])

@router.get("/", response_model=List[StudentSchema])
async def get_students():
    """
    Retrieve all students.
    """
    students = await StudentService.get_all_students()
    return students

@router.get("/{student_id}", response_model=StudentSchema)
async def get_student(student_id: str):
    """
    Retrieve a single student by student_id.
    """
    student = await StudentService.get_student_by_id(student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with ID '{student_id}' not found"
        )
    return student

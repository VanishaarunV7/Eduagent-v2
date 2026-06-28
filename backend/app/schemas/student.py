from pydantic import BaseModel, Field

class StudentSchema(BaseModel):
    student_id: str = Field(..., description="Unique identifier for the student")
    name: str = Field(..., description="Full name of the student")
    program_id: str = Field(..., description="Identifier for the program the student belongs to")
    batch: str = Field(..., description="Academic batch of the student")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "student_id": "std001",
                "name": "Aarav Sharma",
                "program_id": "cs001",
                "batch": "2024"
            }
        }

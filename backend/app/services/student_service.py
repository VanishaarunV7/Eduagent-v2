from typing import List, Optional
from app.database.mongodb import db

class StudentService:
    @staticmethod
    async def get_all_students() -> List[dict]:
        """
        Retrieves all student records from MongoDB.
        Excludes the internal MongoDB _id field.
        """
        students_cursor = db.students.find({}, {"_id": 0})
        return await students_cursor.to_list(length=None)

    @staticmethod
    async def get_student_by_id(student_id: str) -> Optional[dict]:
        """
        Retrieves a single student record by their student_id.
        Excludes the internal MongoDB _id field.
        """
        return await db.students.find_one({"student_id": student_id}, {"_id": 0})

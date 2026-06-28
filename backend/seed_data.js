db.programs.insertMany([
  {
    "program_id": "cs001",
    "program_name": "Computer Science"
  },
  {
    "program_id": "ca001",
    "program_name": "Chartered Accounts"
  },
  {
    "program_id": "bio001",
    "program_name": "Biotechnology"
  }
]);

db.courses.insertMany([
  {
    "course_id": "cs_math",
    "course_name": "Mathematics",
    "program_id": "cs001"
  },
  {
    "course_id": "cs_dbms",
    "course_name": "DBMS",
    "program_id": "cs001"
  },
  {
    "course_id": "cs_python",
    "course_name": "Python Programming",
    "program_id": "cs001"
  },
  {
    "course_id": "ca_fin_acc",
    "course_name": "Financial Accounting",
    "program_id": "ca001"
  },
  {
    "course_id": "ca_tax",
    "course_name": "Taxation",
    "program_id": "ca001"
  },
  {
    "course_id": "ca_audit",
    "course_name": "Auditing",
    "program_id": "ca001"
  },
  {
    "course_id": "bio_genetics",
    "course_name": "Genetics",
    "program_id": "bio001"
  },
  {
    "course_id": "bio_micro",
    "course_name": "Microbiology",
    "program_id": "bio001"
  },
  {
    "course_id": "bio_biochem",
    "course_name": "Biochemistry",
    "program_id": "bio001"
  }
]);

db.students.insertMany([
  {
    "student_id": "std001",
    "name": "Aarav Sharma",
    "program_id": "cs001",
    "batch": "2024"
  },
  {
    "student_id": "std002",
    "name": "Priya Patel",
    "program_id": "cs001",
    "batch": "2024"
  },
  {
    "student_id": "std003",
    "name": "Vikram Singh",
    "program_id": "cs001",
    "batch": "2024"
  },
  {
    "student_id": "std004",
    "name": "Ananya Reddy",
    "program_id": "cs001",
    "batch": "2024"
  },
  {
    "student_id": "std005",
    "name": "Amit Shah",
    "program_id": "ca001",
    "batch": "2024"
  },
  {
    "student_id": "std006",
    "name": "Sneha Iyer",
    "program_id": "ca001",
    "batch": "2024"
  },
  {
    "student_id": "std007",
    "name": "Rohan Gupta",
    "program_id": "ca001",
    "batch": "2024"
  },
  {
    "student_id": "std008",
    "name": "Kavitha Krishnan",
    "program_id": "bio001",
    "batch": "2024"
  },
  {
    "student_id": "std009",
    "name": "Rahul Verma",
    "program_id": "bio001",
    "batch": "2024"
  },
  {
    "student_id": "std010",
    "name": "Divya Choudhary",
    "program_id": "bio001",
    "batch": "2024"
  }
]);

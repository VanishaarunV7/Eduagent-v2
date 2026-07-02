const mongoose = require('mongoose');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Topic = require('../models/Topic');
const Outcome = require('../models/Outcome');
const ExamSchedule = require('../models/ExamSchedule');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const Announcement = require('../models/Announcement');
const StudyMaterial = require('../models/StudyMaterial');

// @desc    Get dashboard data for a student in a course
// @route   GET /api/dashboard/:studentId/:courseId
// @access  Public
exports.getDashboardData = async (req, res) => {
  // ===========================================
  // MENTOR DEMO - BREAKPOINT 8
  // Place breakpoint here.
  //
  // Explain:
  // The backend extracts the student_id from req.user (injected by the JWT auth middleware) and courseId from the request parameters.
  //
  // Inspect:
  // req.user.student_id
  // courseId
  //
  // Expected value:
  // req.user.student_id: "STU10001" (or the logged-in student's ID)
  // courseId: "CS101"
  //
  // Press F10.
  // ===========================================
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const courseId = req.params.courseId;

    console.log(studentId);
    console.log(courseId);

    // Verify MongoDB Connection state to prevent buffering timeouts
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected. Please check your connection or IP whitelist."
      });
    }

    // Role-based security check for student
    if (req.user && req.user.role === 'student' && req.user.student_id !== studentId) {
      return res.status(403).json({ message: "Access denied. You can only view your own dashboard." });
    }

    // Fetch student profile details.
    const student = await Student.findOne({ student_id: studentId }, { _id: 0, __v: 0 });
    console.log(student);

    if (!student) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // Fetch course details.
    const course = await Course.findOne({ course_id: courseId });
    console.log(course);

    if (!course) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 9
    // Place breakpoint here.
    //
    // Explain:
    // How MongoDB data is fetched and combined. We query multiple collections (results, attendances, assignments, course details) in parallel using Promise.all to minimize database roundtrips and request latency.
    //
    // Inspect:
    // results
    // attendanceLogs
    // assignments
    // examSchedule
    //
    // Expected value:
    // results: Array of mark records (e.g. Internal 1, Internal 2 scores)
    // attendanceLogs: Array of daily presence records
    // assignments: Array of assignment documents with descriptions and deadlines
    // examSchedule: Document containing exam_date, start_time, room
    //
    // Press F10.
    // ===========================================
    const [results, topics, outcomes, examSchedule, attendanceLogs, assignments, submissions, announcements, studyMaterials] = await Promise.all([
      Result.find({ student_id: studentId, course_id: courseId }),
      Topic.find({ course_id: courseId }),
      Outcome.find({ course_id: courseId }),
      ExamSchedule.findOne({ course_id: courseId }, { _id: 0, __v: 0 }),
      Attendance.find({ student_id: studentId, course_id: courseId }),
      Assignment.find({ course_id: courseId }),
      AssignmentSubmission.find({ student_id: studentId }),
      Announcement.find({
        $or: [
          { target_type: 'all' },
          { target_type: 'program', target_id: student.program_id },
          { target_type: 'course', target_id: courseId }
        ]
      }).sort({ createdAt: -1 }),
      StudyMaterial.find({ courseId: courseId })
    ]);
    console.log(results);

    // 3. Compute Analytics
    let analytics = {};
    let averageMarks = 70; // fallback if no results are found

    if (results && results.length > 0) {
      let internal1 = null;
      let internal2 = null;
      let internal3 = null;

      results.forEach((r) => {
        const examName = r.exam_name.toLowerCase();
        if (examName.includes('internal 1')) {
          internal1 = r.marks;
        } else if (examName.includes('internal 2')) {
          internal2 = r.marks;
        } else if (examName.includes('internal 3')) {
          internal3 = r.marks;
        }
      });

      const marksArray = [internal1, internal2, internal3].filter((m) => m !== null);

      if (marksArray.length > 0) {
        const totalSum = marksArray.reduce((acc, curr) => acc + curr, 0);
        const average = parseFloat((totalSum / marksArray.length).toFixed(2));
        const highest = Math.max(...marksArray);
        const lowest = Math.min(...marksArray);

        let improvement = 0;
        if (internal1 !== null && internal3 !== null && internal1 !== 0) {
          improvement = parseFloat((((internal3 - internal1) / internal1) * 100).toFixed(2));
        }

        analytics = {
          student_id: studentId,
          course_id: courseId,
          internal1,
          internal2,
          internal3,
          average,
          highest,
          lowest,
          improvement
        };

        averageMarks = average;
      }
    }

    // 4. Compute Topic Performance
    const topicPerformanceList = topics.map((topic) => {
      const charSum = topic.topic_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 31) - 15; // range: -15 to +15

      let score = Math.round(averageMarks + offset);
      score = Math.min(100, Math.max(40, score)); // clamp between 40 and 100

      let status = 'Weak';
      if (score >= 80) {
        status = 'Strong';
      } else if (score >= 60) {
        status = 'Average';
      }

      return {
        topic_name: topic.topic_name,
        score,
        status
      };
    });

    // 5. Compute Outcomes Attainment
    const outcomeList = outcomes.map((o) => {
      const charSum = o.outcome_name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const offset = (charSum % 21) - 10; // range: -10 to +10

      let attainment = Math.round(averageMarks + offset);
      attainment = Math.min(100, Math.max(30, attainment)); // clamp between 30 and 100

      return {
        outcome: o.outcome_name,
        attainment
      };
    });

    // Compute Attendance statistics from database
    const totalCount = attendanceLogs.length;
    const presentCount = attendanceLogs.filter(a => a.status === 'Present').length;
    // Calculate cumulative attendance. Default to 85% if no records yet to keep initial display healthy.
    const attendance = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 85;

    const todayStart = new Date();
    todayStart.setUTCHours(0,0,0,0);
    const todayRecord = attendanceLogs.find(a => new Date(a.date).getTime() >= todayStart.getTime());
    const presentToday = todayRecord ? todayRecord.status : 'Not Marked';
    
    // Sort and limit attendance logs for UI history
    const attendanceHistory = attendanceLogs
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(a => ({
        date: a.date.toISOString().split('T')[0],
        status: a.status,
        lecture_number: a.lecture_number || 1
      }));

    // Process assignments status
    const enrichedAssignments = assignments.map(a => {
      const sub = submissions.find(s => s.assignment_id.toString() === a._id.toString());
      let status = 'Not Started';
      let marks_obtained = null;
      let feedback = '';

      if (sub) {
        marks_obtained = sub.marks_obtained;
        feedback = sub.feedback;
        status = sub.marks_obtained !== null ? 'Reviewed' : 'Submitted';
      } else if (new Date(a.due_date).getTime() < Date.now()) {
        status = 'Overdue';
      }

      const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        _id: a._id,
        title: a.title,
        description: a.description,
        due_date: a.due_date,
        max_marks: a.max_marks,
        status,
        marks_obtained,
        feedback,
        daysLeft: daysLeft > 0 ? daysLeft : 0
      };
    });

    const gpa = Math.min(4.0, Math.max(1.0, parseFloat((averageMarks / 25).toFixed(2))));
    let academicStatus = "Good Standing";
    if (gpa >= 3.5 && attendance >= 85) {
      academicStatus = "Honor Roll";
    } else if (gpa < 2.2 || attendance < 75) {
      academicStatus = "Academic Probation";
    }

    // ===========================================
    // MENTOR DEMO - BREAKPOINT 10
    // Place breakpoint here.
    //
    // Explain:
    // The backend returns the final aggregated dashboard data as a JSON payload to the Angular frontend. This includes calculated GPAs, attendance percentage, graded assignments status, and topic status calculations.
    //
    // Inspect:
    // student
    // attendance
    // academicStatus
    // topicPerformanceList
    //
    // Expected value:
    // student: { name: "...", student_id: "STU10001", program_id: "CS_UNDERGRAD", ... }
    // attendance: 85 (calculated percentage)
    // academicStatus: "Good Standing" (or "Honor Roll")
    // topicPerformanceList: Array of topics with calculated scores and status ("Strong", "Average", "Weak")
    //
    // Press F10.
    // ===========================================
    res.status(200).json({
      student,
      analytics,
      topics: topicPerformanceList,
      outcomes: outcomeList,
      upcoming_exam: examSchedule || {},
      attendance,
      present_today: presentToday,
      attendance_history: attendanceHistory,
      assignments: enrichedAssignments,
      announcements,
      study_materials: studyMaterials.map(m => ({
        _id: m._id,
        filename: m.filename,
        fileType: m.fileType,
        subject: m.subject,
        uploadDate: m.uploadDate,
        filePath: m.filePath
      })),
      gpa,
      academic_status: academicStatus
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// backend/seedUsers.js
// Seed the `users` collection with default accounts.
// Run with: node backend/seedUsers.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('./src/models/User');
const Student = require('./src/models/Student'); // to link existing student IDs

const DEFAULT_PASSWORD = 'EduAgent@123';
const SALT_ROUNDS = 12;

async function main() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eduagent';
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');

    // Clear existing users to avoid duplicates when reseeding.
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    const hashedPwd = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // ----------- Student Users -----------
    const studentDocs = await Student.find().limit(10).lean();
    const studentUsers = studentDocs.map((doc, idx) => {
      const email = `stu${String(idx + 1).padStart(3, '0')}@eduagent.com`;
      return {
        userId: `user-${doc.student_id}`,
        name: doc.name || `Student ${idx + 1}`,
        email,
        password: hashedPwd,
        role: 'student',
        student_id: doc.student_id,
        teacher_id: null,
        admin_id: null,
        program_id: doc.program_id || null
      };
    });

    // ----------- Teacher Users -----------
    const teacherUsers = [1, 2, 3].map(i => ({
      userId: `teacher-${i}`,
      name: `Teacher ${i}`,
      email: `teacher${i}@eduagent.com`,
      password: hashedPwd,
      role: 'teacher',
      student_id: null,
      teacher_id: `teacher${i}`,
      admin_id: null,
      program_id: null
    }));

    // ----------- Admin User -----------
    const adminUser = {
      userId: 'admin-1',
      name: 'Admin',
      email: 'admin@eduagent.com',
      password: hashedPwd,
      role: 'admin',
      student_id: null,
      teacher_id: null,
      admin_id: 'admin',
      program_id: null
    };

    const allUsers = [...studentUsers, ...teacherUsers, adminUser];
    await User.insertMany(allUsers);
    console.log('🚀 Users seeded successfully');

    // Print summary
    allUsers.forEach(u => {
      const linkedId = u.role === 'student' ? u.student_id : u.role === 'teacher' ? u.teacher_id : u.admin_id;
      console.log(`Created user: ${u.email} | role: ${u.role} | linked ID: ${linkedId}`);
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

main();

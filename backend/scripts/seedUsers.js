/**
 * seedUsers.js — Seeds default user accounts for EduAgent
 *
 * Creates student, teacher, and admin users with bcrypt-hashed passwords.
 * Links users to existing MongoDB data (student_id, program_id, etc.)
 *
 * Run: node scripts/seedUsers.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User     = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;

const DEFAULT_USERS = [
  {
    userId:     'usr_student_001',
    name:       'Aarav Sharma',
    email:      'student@eduagent.com',
    password:   'Student@123',
    role:       'student',
    student_id: 'stu001',
    teacher_id: null,
    admin_id:   null,
    program_id: 'btech_cs'
  },
  {
    userId:     'usr_student_002',
    name:       'Priya Patel',
    email:      'student2@eduagent.com',
    password:   'Student@123',
    role:       'student',
    student_id: 'stu002',
    teacher_id: null,
    admin_id:   null,
    program_id: 'btech_cs'
  },
  {
    userId:     'usr_student_003',
    name:       'Rahul Verma',
    email:      'student3@eduagent.com',
    password:   'Student@123',
    role:       'student',
    student_id: 'stu003',
    teacher_id: null,
    admin_id:   null,
    program_id: 'btech_cs'
  },
  {
    userId:     'usr_teacher_001',
    name:       'Dr. Meera Nair',
    email:      'teacher@eduagent.com',
    password:   'Teacher@123',
    role:       'teacher',
    student_id: null,
    teacher_id: 'tch001',
    admin_id:   null,
    program_id: 'btech_cs'
  },
  {
    userId:     'usr_admin_001',
    name:       'Admin EduAgent',
    email:      'admin@eduagent.com',
    password:   'Admin@123',
    role:       'admin',
    student_id: null,
    teacher_id: null,
    admin_id:   'adm001',
    program_id: null
  }
];

async function seedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB.');

    let created = 0, skipped = 0;

    for (const userData of DEFAULT_USERS) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`  SKIP — User already exists: ${userData.email} (${userData.role})`);
        skipped++;
        continue;
      }

      const user = new User(userData);
      await user.save(); // bcrypt hashing triggered by pre-save hook
      console.log(`  ✔ Created: ${userData.email} (${userData.role})`);
      created++;
    }

    console.log(`\nSeed complete! ${created} created, ${skipped} skipped.`);
    console.log('\nDefault login credentials:');
    console.log('  Student :  student@eduagent.com  / Student@123');
    console.log('  Student2:  student2@eduagent.com / Student@123');
    console.log('  Student3:  student3@eduagent.com / Student@123');
    console.log('  Teacher :  teacher@eduagent.com  / Teacher@123');
    console.log('  Admin   :  admin@eduagent.com    / Admin@123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedUsers();

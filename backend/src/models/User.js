/**
 * User.js — Mongoose Model for Authentication & RBAC
 *
 * Stores authentication credentials and role assignments.
 * Linked to existing Student / Teacher / Admin collections via role-specific IDs.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      required: true,
      default: 'student'
    },
    // Role-specific links (nullable depending on role)
    student_id: {
      type: String,
      default: null
    },
    teacher_id: {
      type: String,
      default: null
    },
    admin_id: {
      type: String,
      default: null
    },
    program_id: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

// ─── Pre-save hook: hash password before saving ───────────────────────────────
UserSchema.pre('save', async function (next) {
  // Only hash if password was modified (new user or password change)
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance method: compare plain password to hash ─────────────────────────
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// ─── Static method: find user with password field included ────────────────────
UserSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() }).select('+password');
};

module.exports = mongoose.model('User', UserSchema);

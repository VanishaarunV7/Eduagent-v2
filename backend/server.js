require("dotenv").config();
const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");

// Import models for count and debug endpoints
const Student = require('./src/models/Student');
const Course = require('./src/models/Course');
const Result = require('./src/models/Result');
const Topic = require('./src/models/Topic');
const Outcome = require('./src/models/Outcome');
const ExamSchedule = require('./src/models/ExamSchedule');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Helper function to extract all registered routes
const getRoutesList = (expressApp) => {
  const routes = [];
  const print = (path, layer) => {
    if (layer.route) {
      layer.route.stack.forEach((stackItem) => {
        if (stackItem.method) {
          routes.push({
            method: stackItem.method.toUpperCase(),
            path: (path + (layer.route.path === '/' ? '' : layer.route.path)).replace(/\/+/g, '/') || '/'
          });
        }
      });
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      let routerPath = '';
      if (layer.regexp) {
        const source = layer.regexp.source;
        const cleanedSource = source.replace(/\\/g, '');
        const match = cleanedSource.match(/^\^\/([a-zA-Z0-9_\-\/]+)/);
        if (match && match[1]) {
          routerPath = '/' + match[1];
        }
      }
      layer.handle.stack.forEach((handlerLayer) => {
        print(path + routerPath, handlerLayer);
      });
    }
  };

  expressApp._router.stack.forEach((layer) => {
    print('', layer);
  });

  const uniqueRoutes = [];
  const seen = new Set();
  routes.forEach(r => {
    const key = `${r.method}:${r.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRoutes.push(r);
    }
  });
  return uniqueRoutes;
};

// MongoDB Connection and Startup Logs
mongoose.set('bufferCommands', false);

const logStatsAndRoutes = async () => {
  try {
    const [studentsCount, coursesCount, resultsCount, topicsCount, outcomesCount, examsCount] = await Promise.all([
      Student.countDocuments(),
      Course.countDocuments(),
      Result.countDocuments(),
      Topic.countDocuments(),
      Outcome.countDocuments(),
      ExamSchedule.countDocuments()
    ]);
    console.log("Collection counts:");
    console.log(`- Students: ${studentsCount}`);
    console.log(`- Courses: ${coursesCount}`);
    console.log(`- Results: ${resultsCount}`);
    console.log(`- Topics: ${topicsCount}`);
    console.log(`- Outcomes: ${outcomesCount}`);
    console.log(`- Exam Schedules: ${examsCount}`);

    console.log("Registered routes:");
    const routesList = getRoutesList(app);
    routesList.forEach(r => {
      console.log(`- ${r.method} ${r.path}`);
    });
  } catch (err) {
    console.error("Error reading collection counts/routes on startup:", err.message);
  }
};

const connectWithFallback = async () => {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    console.log("MongoDB connection success. Ready state:", mongoose.connection.readyState);
    await logStatsAndRoutes();
  } catch (err) {
    console.error("MongoDB Atlas Connection Failed:", err.message);
    console.log("⚠️ Falling back to local in-memory MongoDB database...");
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const localUri = mongod.getUri();
      console.log(`In-memory MongoDB started at: ${localUri}`);

      await mongoose.connect(localUri);
      console.log("Connected to in-memory MongoDB. Ready state:", mongoose.connection.readyState);

      console.log("Seeding in-memory database with sample data...");
      const seedData = require('./seed');
      await seedData();
      console.log("In-memory database seeded successfully!");

      await logStatsAndRoutes();
    } catch (fallbackErr) {
      console.error("Failed to initialize in-memory MongoDB fallback:", fallbackErr.message);
    }
  }
};

connectWithFallback();

const studentRoutes = require('./src/routes/studentRoutes');
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const topicRoutes = require('./src/routes/topicRoutes');
const outcomeRoutes = require("./src/routes/outcomeRoutes");
const examRoutes = require('./src/routes/examRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const comparisonRoutes = require('./src/routes/comparisonRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const pdfUploadRoute = require('./src/routes/pdfUploadRoute');
const studyPlanRoutes = require('./src/routes/studyPlanRoutes');
const authRoutes = require('./src/routes/authRoutes');
const { authenticateJWT } = require('./src/middleware/auth');

// Health check endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    database: dbState
  });
});

// Debug DB count endpoint
app.get('/debug/db', async (req, res) => {
  try {
    const [studentsCount, coursesCount, resultsCount, topicsCount, outcomesCount, examsCount] = await Promise.all([
      Student.countDocuments(),
      Course.countDocuments(),
      Result.countDocuments(),
      Topic.countDocuments(),
      Outcome.countDocuments(),
      ExamSchedule.countDocuments()
    ]);
    res.status(200).json({
      students_count: studentsCount,
      courses_count: coursesCount,
      results_count: resultsCount,
      topics_count: topicsCount,
      outcomes_count: outcomesCount,
      exams_count: examsCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Debug registered routes endpoint
app.get('/debug/routes', (req, res) => {
  const routesList = getRoutesList(app);
  res.status(200).json(routesList);
});

// Health check endpoint at root
app.get('/', (req, res) => {
  res.status(200).json({ status: 'running' });
});

// ── Public routes (no JWT) ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── JWT protection: all /api/* routes below this point require a valid token ─
app.use('/api', authenticateJWT);

// Register protected routes
app.use('/api/students', studentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use('/api/topics', topicRoutes);
app.use("/api/outcomes", outcomeRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', pdfUploadRoute);
app.use('/api/study-plans', studyPlanRoutes);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'An unexpected internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


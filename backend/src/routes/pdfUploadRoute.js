const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfUploadController = require('../controllers/pdfUploadController');
const { authenticateJWT } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  }
});

// File filter to support PDF, DOCX, PPT/PPTX, and Images (PNG, JPG, JPEG)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.pdf', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg'];
  
  const isAllowedExt = allowedExts.includes(ext);
  const isAllowedMime = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ].includes(file.mimetype);

  if (isAllowedExt || isAllowedMime) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not supported. Supported: PDF, DOCX, PPT/PPTX, PNG, JPG, JPEG`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit (Feature 1)
});

// Middleware wrapper to handle errors and keep all uploaded files under req.files
const handleMulterUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Routes definition
router.post('/', authenticateJWT, handleMulterUpload, pdfUploadController.uploadPDF);
router.get('/', authenticateJWT, pdfUploadController.listMaterials);
router.delete('/:documentId', authenticateJWT, pdfUploadController.deleteMaterial);

module.exports = router;

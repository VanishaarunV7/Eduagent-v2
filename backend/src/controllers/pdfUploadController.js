const StudyMaterial = require('../models/StudyMaterial');
const documentProcessorService = require('../services/documentProcessorService');
const vectorStoreService = require('../rag/vectorstore/vectorStoreService');
const fs = require('fs');
const path = require('path');

/**
 * Handle POST /api/upload
 * Accept PDF, DOCX, PPT/PPTX, Images, parse text, chunk, embed, store in ChromaDB, and save metadata to MongoDB.
 */
exports.uploadPDF = async (req, res) => {
  const uploadedFiles = [];
  try {
    const files = req.files || (req.file ? [req.file] : []);
    const studentId = req.user.role === 'student' ? req.user.student_id : (req.body.student_id || req.body.studentId);
    const course = req.body.course || req.body.course_id;
    const subject = req.body.subject || '';

    // Validation
    if (files.length === 0) {
      return res.status(400).json({ message: 'No file uploaded. Please upload supported files using multipart/form-data.' });
    }
    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      cleanupFiles(files);
      return res.status(400).json({ message: 'Missing or invalid required field: student_id' });
    }
    if (!course || typeof course !== 'string' || !course.trim()) {
      cleanupFiles(files);
      return res.status(400).json({ message: 'Missing or invalid required field: course' });
    }

    const courseId = course.trim();
    const cleanStudentId = studentId.trim();

    console.log(`[Upload API] Processing ${files.length} file(s) for Student: ${cleanStudentId}, Course: ${courseId}`);

    const results = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'pdf';
      if (ext === '.pdf') fileType = 'pdf';
      else if (ext === '.docx') fileType = 'docx';
      else if (ext === '.ppt' || ext === '.pptx') fileType = 'pptx';
      else if (['.png', '.jpg', '.jpeg'].includes(ext)) fileType = 'image';
      else {
        // Safe check
        fs.unlinkSync(file.path);
        continue;
      }

      uploadedFiles.push(file.path);

      const metadataBase = {
        filename: file.originalname,
        courseId: courseId,
        studentId: cleanStudentId,
        subject: subject,
        uploadDate: new Date().toISOString()
      };

      // Process document text, chunking
      let processResult = { pages: 1, chunksCount: 0, documents: [] };
      try {
        processResult = await documentProcessorService.processDocument(file.path, fileType, metadataBase);
      } catch (err) {
        console.warn(`[Upload API] Document processing failed for ${file.originalname}:`, err.message);
      }

      // Store in ChromaDB (with graceful connection fallback)
      if (processResult.documents && processResult.documents.length > 0) {
        try {
          await vectorStoreService.addChunks(processResult.documents);
        } catch (chromaErr) {
          console.warn(`[Upload API] ChromaDB connection failed. Study material ${file.originalname} uploaded to MongoDB successfully, but vector indexing was skipped:`, chromaErr.message);
        }
      }

      // Save metadata in MongoDB
      const material = new StudyMaterial({
        filename: file.originalname,
        filePath: file.path,
        courseId: courseId,
        studentId: cleanStudentId,
        subject: subject,
        fileType: fileType,
        pages: processResult.pages || 1,
        chunksCount: processResult.chunksCount || 0
      });

      await material.save();

      console.log(`[Upload API] Successfully processed and indexed ${file.originalname}. Pages: ${processResult.pages}, Chunks: ${processResult.chunksCount}`);

      results.push({
        _id: material._id,
        filename: file.originalname,
        fileType: fileType,
        pages: processResult.pages,
        chunks: processResult.chunksCount
      });
    }

    // Return the response structure
    return res.status(200).json(results.length === 1 ? results[0] : results);

  } catch (error) {
    console.error('[Upload API Error]:', error);
    cleanupFiles(uploadedFiles);
    return res.status(500).json({ message: error.message || 'An unexpected error occurred during document upload processing' });
  }
};

/**
 * Handle GET /api/upload/student/:studentId/course/:courseId
 * Retrieve the metadata list of uploaded study materials
 */
exports.listMaterials = async (req, res) => {
  try {
    const studentId = req.user.role === 'student' ? req.user.student_id : req.params.studentId;
    const { courseId } = req.params;
    if (!studentId || !courseId) {
      return res.status(400).json({ message: 'Missing required parameters: studentId, courseId' });
    }

    const list = await StudyMaterial.find({
      studentId: studentId.trim(),
      courseId: courseId.trim()
    }).sort({ createdAt: -1 });

    return res.status(200).json(list);
  } catch (error) {
    console.error('[List Materials API Error]:', error);
    return res.status(500).json({ message: error.message || 'Error listing study materials' });
  }
};

/**
 * Handle DELETE /api/upload/:documentId
 * Delete a specific study material from uploads directory, MongoDB, and ChromaDB chunks
 */
exports.deleteMaterial = async (req, res) => {
  try {
    const { documentId } = req.params;
    if (!documentId) {
      return res.status(400).json({ message: 'Missing required parameter: documentId' });
    }

    const material = await StudyMaterial.findById(documentId);
    if (!material) {
      return res.status(404).json({ message: 'Study material not found' });
    }

    // Secure file deletion for students
    if (req.user && req.user.role === 'student' && material.studentId !== req.user.student_id) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own study materials.' });
    }

    // 1. Remove file from disk
    if (fs.existsSync(material.filePath)) {
      try {
        fs.unlinkSync(material.filePath);
      } catch (fileErr) {
        console.warn(`[Delete API] File system unlink failed for ${material.filePath}:`, fileErr.message);
      }
    }

    // 2. Delete chunks from ChromaDB
    await vectorStoreService.deleteChunks(material.filename, material.studentId, material.courseId);

    // 3. Delete metadata from MongoDB
    await StudyMaterial.findByIdAndDelete(documentId);

    console.log(`[Delete API] Successfully deleted material ${material.filename} (ID: ${documentId})`);
    return res.status(200).json({ message: `Successfully deleted study material: ${material.filename}` });

  } catch (error) {
    console.error('[Delete Material API Error]:', error);
    return res.status(500).json({ message: error.message || 'Error deleting study material' });
  }
};

/**
 * Helper to cleanup temporary uploaded files on error
 */
function cleanupFiles(files) {
  for (const file of files) {
    const filePath = typeof file === 'string' ? file : file.path;
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('[CleanupFiles Error]:', err.message);
      }
    }
  }
}

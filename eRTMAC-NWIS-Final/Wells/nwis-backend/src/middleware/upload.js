// =============================================================================
// NWIS Backend — File Upload Middleware (Multer)
// =============================================================================

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.memoryStorage();

/**
 * File filter: accept only PDFs and common document formats.
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/tiff',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

/**
 * Upload middleware for single document upload.
 * Max file size: 50 MB.
 */
const uploadDocument = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
}).single('document');

/**
 * Upload middleware for multiple documents (batch upload).
 * Max 10 files, 50 MB each.
 */
const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
}).array('documents', 10);

module.exports = { uploadDocument, uploadDocuments };

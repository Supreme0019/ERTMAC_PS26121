// =============================================================================
// NWIS Backend — Object Storage Configuration
// =============================================================================
// Provides helpers for S3-compatible object storage (MinIO / AWS S3).
// Used for storing PDFs, reports, and other uploaded documents.
// =============================================================================

const env = require('./env');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// For the SIH hackathon MVP, we use local filesystem storage instead of
// requiring a running MinIO/S3 instance. In production, swap this out for
// the AWS SDK or MinIO client.
// ---------------------------------------------------------------------------

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Store a file buffer to local storage.
 * @param {string} key - Storage key / relative path
 * @param {Buffer} buffer - File content
 * @returns {Promise<string>} - The file URI
 */
const putObject = async (key, buffer) => {
  const filePath = path.join(UPLOAD_DIR, key);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, buffer);
  logger.debug({ key }, 'File stored to local storage');
  return `local://${key}`;
};

/**
 * Retrieve a file from local storage.
 * @param {string} key - Storage key
 * @returns {Promise<Buffer>}
 */
const getObject = async (key) => {
  const filePath = path.join(UPLOAD_DIR, key);
  return fs.readFileSync(filePath);
};

/**
 * Delete a file from local storage.
 * @param {string} key - Storage key
 */
const deleteObject = async (key) => {
  const filePath = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.debug({ key }, 'File deleted from local storage');
  }
};

/**
 * Get a URL for a stored file.
 * @param {string} key
 * @returns {string}
 */
const getObjectUrl = (key) => {
  return `/api/documents/file/${encodeURIComponent(key)}`;
};

module.exports = {
  putObject,
  getObject,
  deleteObject,
  getObjectUrl,
  UPLOAD_DIR,
};

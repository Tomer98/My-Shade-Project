/**
 * File Upload Middleware
 * Configures Multer for handling image uploads, including directory creation,
 * filename sanitization, and file type/size validations.
 */
const multer = require('multer');

// memoryStorage keeps the file in RAM as req.file.buffer
// instead of writing it to disk. The storageService then
// streams it directly to S3 — the container's filesystem is never touched.
const storage = multer.memoryStorage();

// File filter to explicitly allow only image mime types
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed!'), false);
    }
};

// Initialize the Multer middleware with the configuration and a 5MB size limit
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = upload;
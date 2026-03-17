/**
 * File Upload Middleware
 * Configures Multer for handling image uploads, including directory creation,
 * filename sanitization, and file type/size validations.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Docker compatibility: Using process.cwd() ensures we target the root server directory
const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure the 'uploads' directory exists before accepting files
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log("✅ Created 'uploads' directory successfully.");
    } catch (err) {
        console.error("❌ Failed to create 'uploads' directory. Check permissions!", err);
    }
}

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to the configured uploads directory
    },
    filename: function (req, file, cb) {
        // Generate a unique identifier to prevent file overwriting
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        
        // Sanitize the original filename (replace spaces with underscores to prevent URL issues)
        const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
        
        cb(null, uniqueSuffix + path.extname(sanitizedOriginalName));
    }
});

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
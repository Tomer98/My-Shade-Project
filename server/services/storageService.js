/**
 * Storage Service
 * Cloud-agnostic file upload abstraction over S3-compatible object storage.
 *
 * Works with:
 *   - AWS S3             (leave STORAGE_ENDPOINT empty)
 *   - Cloudflare R2      (set STORAGE_ENDPOINT to your R2 endpoint)
 *   - MinIO              (set STORAGE_ENDPOINT to your MinIO URL)
 *   - DigitalOcean Spaces (set STORAGE_ENDPOINT to your Spaces endpoint)
 *
 * To switch providers: change STORAGE_ENDPOINT + credentials in .env.
 * No code changes required.
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const crypto = require('crypto');

// --- S3 Client Configuration ---
// If STORAGE_ENDPOINT is set, the client targets that provider instead of AWS.
// This is the key to provider portability.
const clientConfig = {
    region: process.env.STORAGE_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
};

if (process.env.STORAGE_ENDPOINT) {
    clientConfig.endpoint = process.env.STORAGE_ENDPOINT;
    // Required for non-AWS providers (they use path-style URLs: endpoint/bucket/key)
    clientConfig.forcePathStyle = true;
}

const s3 = new S3Client(clientConfig);

/**
 * Uploads a file to S3-compatible object storage.
 *
 * @param {Express.Multer.File} file - The file object from req.file (memoryStorage)
 *   file.buffer   — the raw file bytes in memory
 *   file.mimetype — e.g. "image/png"
 *   file.originalname — original filename from the client
 *
 * @returns {Promise<string>} The public URL of the uploaded file
 */
exports.uploadFile = async (file) => {
    // Generate a unique filename to prevent overwriting existing files
    // crypto.randomBytes gives us a random hex string, path.extname gets ".jpg" etc.
    const uniqueKey = `uploads/${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname)}`;

    const command = new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET_NAME,
        Key: uniqueKey,           // The path inside the bucket
        Body: file.buffer,        // The raw file bytes from Multer memoryStorage
        ContentType: file.mimetype,
    });

    await s3.send(command);

    // Build the public URL — standard S3 URL format
    // For other providers with custom endpoints, adjust this format accordingly
    const endpoint = process.env.STORAGE_ENDPOINT;
    if (endpoint) {
        return `${endpoint}/${process.env.STORAGE_BUCKET_NAME}/${uniqueKey}`;
    }

    return `https://${process.env.STORAGE_BUCKET_NAME}.s3.${process.env.STORAGE_REGION || 'us-east-1'}.amazonaws.com/${uniqueKey}`;
};

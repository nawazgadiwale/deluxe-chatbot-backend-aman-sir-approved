const multer = require("multer")
const storage = multer.memoryStorage()

const ALLOWED_MIME_TYPES = [
    // PDF
    "application/pdf",
    // Plain text
    "text/plain",
    "text/csv",
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Microsoft Word
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Microsoft Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Zip / generic archive (optional — remove if you don't want this)
    "application/zip",
]

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return cb(null, true)
    }
    cb(new Error(`File type "${file.mimetype}" is not supported.`))
}

const uploadDocumentMiddleWare = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024
    }
})

module.exports = uploadDocumentMiddleWare
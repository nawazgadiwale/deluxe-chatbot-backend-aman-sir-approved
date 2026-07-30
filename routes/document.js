const express = require("express")
const authenticateToken = require("../middlewares/authMiddleware")
const { createFolder, createDocument, updateFolderPermissions, updateDocumentPermissions, getAllFolders, getAllDocuments, getDashboardData, getFolderTree, openDocument, moveFolder, moveDocument, uploadDocument } = require('../controllers/documentController')
const uploadDocumentMiddleWare = require("../middlewares/uploadDocumentMiddleWare")
const router = express.Router()

// Create folder api
// POST
router.post('/folder', authenticateToken, createFolder)

// Create document api
//  POST
router.post('/doc', authenticateToken, createDocument)

// Update folder permission
// PUT
router.put('/folder/:id/permission', authenticateToken, updateFolderPermissions)

// Update document permission
// PUT
router.put('/doc/:id/permission', authenticateToken, updateDocumentPermissions)

// Get all folders
// GET
router.get('/folders', getAllFolders)

// Get all folders tree
// GET
router.get('/tree', getFolderTree)

// Get all documents
// GET
router.get('/documents', getAllDocuments)

// Get dashboard data
// GET
router.get('/dashboard', getDashboardData)

// Last who opened document
// GET
router.get('/doc/:id/open', authenticateToken, openDocument)

// Move to folder 
router.patch('/folders/:id/move', authenticateToken, moveFolder)

// Move to document
router.patch('/documents/:id/move', authenticateToken, moveDocument)

// raw file upload endpoint (pdf, txt, image, docx, xlsx, pptx, etc)
router.post("/upload", authenticateToken, uploadDocumentMiddleWare.array("files", 10), uploadDocument);

module.exports = router
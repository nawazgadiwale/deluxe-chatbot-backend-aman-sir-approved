const express = require('express')
const { createSheet, getSheets, getSheetsDashboard } = require('../controllers/sheetsController')
const router = express.Router()

// Create new sheet
// POST
router.post('/add', createSheet)

// Get all sheets data
// GET
router.get('/all', getSheets)

// Get Sheets Dashboard Data
// GET
router.get('/dashboard', getSheetsDashboard)

module.exports = router;
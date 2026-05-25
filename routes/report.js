const express = require('express')
const { getReportsDashboardData } = require('../controllers/reportController')
const router = express.Router()

// Main Dashboard data
// GET
router.get('/dashboard', getReportsDashboardData)

module.exports = router;
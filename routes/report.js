const express = require('express')
const { getReportsDashboardData } = require('../controllers/reportController');
const authenticateToken = require('../middlewares/authMiddleware');
const router = express.Router()

// Main Dashboard data
// GET
router.get('/dashboard', authenticateToken, getReportsDashboardData)

module.exports = router;
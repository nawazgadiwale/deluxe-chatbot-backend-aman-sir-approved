const express = require('express')
const { getReportsDashboardData, getDetailedAnalyticsData,  } = require('../controllers/reportController');
const authenticateToken = require('../middlewares/authMiddleware');
const router = express.Router()

// Main Dashboard data
// GET
router.get('/dashboard', getReportsDashboardData)

// GET
router.get('/analytics', getDetailedAnalyticsData)

module.exports = router;
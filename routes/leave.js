const express = require('express')
const { addLeave, getLeavesByEmployee, getLeavesByYear } = require('../controllers/leavesController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// create new leave entry6
// POST
router.post('/add', authenticateToken, addLeave)

// get leaves by employee
// GET
router.get('/get/:employeeId', authenticateToken, getLeavesByEmployee)

// leaves dashboard
// GET
router.get('/calendar/:year', authenticateToken, getLeavesByYear)

module.exports = router
const express = require('express')
const { addLeave, getLeavesByEmployee, getLeavesByYear, updateLeave, deleteLeave } = require('../controllers/leavesController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// create new leave entry
// POST
router.post('/add', authenticateToken, addLeave)

// get leaves by employee
// GET
router.get('/get/:employeeId', authenticateToken, getLeavesByEmployee)

// leaves dashboard
// GET
router.get('/calendar/:year', authenticateToken, getLeavesByYear)

// Update leave
// PUT
router.put('/edit/:leaveId', authenticateToken, updateLeave)

// Delete leave
// DELETE
router.delete('/delete/:leaveId', authenticateToken, deleteLeave)

module.exports = router
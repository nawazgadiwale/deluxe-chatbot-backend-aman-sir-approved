const express = require('express')
const authenticateToken = require('../middlewares/authMiddleware')
const { addLeave, deleteLeave } = require('../controllers/leavesController')
const { getAllOT, updateOt } = require('../controllers/otController')
const router = express.Router()

// create new Overtime record
// POST
router.post('/add', authenticateToken, addLeave)

// get all overtime with filters
// GET
router.get('/get', authenticateToken, getAllOT)

// update an overTime record
// PUT
router.put('/edit/:otId', authenticateToken, updateOt)

// delete an overtime record
// DELETE
router.delete('/delete/:otId', authenticateToken, deleteLeave)

module.exports = router
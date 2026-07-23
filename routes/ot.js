const express = require('express')
const authenticateToken = require('../middlewares/authMiddleware')
const { getAllOT, updateOt, addOverTime, deleteOt } = require('../controllers/otController')
const router = express.Router()

// create new Overtime record
// POST
router.post('/add', authenticateToken, addOverTime)

// get all overtime with filters
// GET
router.get('/get', authenticateToken, getAllOT)

// update an overTime record
// PUT
router.put('/edit/:otId', authenticateToken, updateOt)

// delete an overtime record
// DELETE
router.delete('/delete/:otId', authenticateToken, deleteOt)

module.exports = router
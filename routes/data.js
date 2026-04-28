const express = require('express')
const { addNewLeadData,getAllLeadsData, getIndividualLeadData, addFollowUp, updateLeadData, getLeadDashboardData } = require('../controllers/dataController')
const router = express.Router()

// create new lead
// POST
router.post('/lead', addNewLeadData)

// update lead data
// PUT
router.put('/lead/:uid', updateLeadData)

// get all leads
// GET
router.get('/leads', getAllLeadsData)

// get lead data
// GET
router.get('/lead/:uid', getIndividualLeadData)

// add follow up data
// POST
router.post('/lead/:uid/followup', addFollowUp)

// get dashboard data
// GET 
router.get('/all', getLeadDashboardData)

module.exports = router
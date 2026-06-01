const express = require('express')
const { addNewLeadData,getAllLeadsData, getIndividualLeadData, addFollowUp, updateLeadData, getLeadDashboardData, getFollowUpPriorityList, updateFirstFollowupdate, getGlobalSearchAllLeadsData } = require('../controllers/dataController')
const router = express.Router()

// create new lead
// POST
router.post('/lead', addNewLeadData)

// update lead data
// PUT
router.put('/lead/:uid', updateLeadData)

// update first followup date
// POST
router.post('/lead-first/:uid', updateFirstFollowupdate)

// get all leads
// GET
router.get('/leads', getAllLeadsData)

// get global search all leads data
// GET
router.get('/leads/global-search', getGlobalSearchAllLeadsData)

// get lead data
// GET
router.get('/lead/:uid', getIndividualLeadData)

// add follow up data
// PUT
router.put('/lead/:uid/followup', addFollowUp)

// get dashboard data
// GET 
router.get('/all', getLeadDashboardData)

// get followup priority list
// GET
router.get('/priority-followup', getFollowUpPriorityList)

module.exports = router
const express = require('express')
const { addNewLeadData, getAllLeadsData, getAllCustomerIds, getIndividualLeadData, addFollowUp, updateLeadData, getLeadDashboardData, getFollowUpPriorityList, updateFirstFollowupdate, getGlobalSearchAllLeadsData, updateFollowUpClientResponse } = require('../controllers/dataController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// create new lead
// POST
router.post('/lead', addNewLeadData)

// getAdded Ids
// POST
router.post('/customer/ids', authenticateToken, getAllCustomerIds)

// update lead data
// PUT
router.put('/lead/:uid', authenticateToken, updateLeadData)

// update first followup date
// POST
router.post('/lead-first/:uid', authenticateToken, updateFirstFollowupdate)

// get all leads
// GET
router.get('/leads', authenticateToken, getAllLeadsData)

// get global search all leads data
// GET
router.get('/leads/global-search', authenticateToken, getGlobalSearchAllLeadsData)

// get lead data
// GET
router.get('/lead/:uid', authenticateToken, getIndividualLeadData)

// add follow up data
// PUT
router.put('/lead/:uid/followup', authenticateToken, addFollowUp)

// get dashboard data
// GET 
router.get('/all', getLeadDashboardData)

// get followup priority list
// GET
router.get('/priority-followup', authenticateToken, getFollowUpPriorityList)

// update client response for the client
// PATCH 
router.patch('/leads/:refNo/followup/:followUpId/client-response', authenticateToken, updateFollowUpClientResponse)

module.exports = router
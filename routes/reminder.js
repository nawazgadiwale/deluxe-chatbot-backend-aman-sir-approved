const express = require('express')
const { createCategory, updateCategory, getindividualCategoryData, getAllCategoryList, deleteCategory, createReminder, updateReminder, getIndividualReminder, getAllReminderList, dashboardStats, updateReminderStatus, upcomingExpiryReminder, deleteReminder, exportAllReminders, bulkupdateReminderStatus, getReminderHistory, getEmployeeAndCategory } = require('../controllers/reminderController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// create category
// POST
router.post('/category',authenticateToken, createCategory)

// update category
// PUT
router.put('/category/:catId',authenticateToken, updateCategory)

// get individual category
// GET
router.get('/category/:catId',authenticateToken, getindividualCategoryData)

// get all category 
// GET
router.get('/categories',authenticateToken, getAllCategoryList)

// delete individual category
// DELETE
router.delete('/category/:catId',authenticateToken, deleteCategory)

// create reminder
// POST
router.post('/reminder',authenticateToken, createReminder)

// update reminder
// PUT
router.put('/reminder/:refNumber',authenticateToken, updateReminder)

// get individual reminder
// GET
router.get('/reminder/:refNumber',authenticateToken, getIndividualReminder)

// get all reminder list
// GET
router.get('/reminders',authenticateToken, getAllReminderList)

// delete reminder
// DELETE
router.delete('/reminder/:refNumber',authenticateToken, deleteReminder)

// Update reminder status
// PUT
router.put('/update-reminder-status/:refNumber',authenticateToken, updateReminderStatus)

// Bulk update reminders
// POST
router.post('/bulk-update-status',authenticateToken, bulkupdateReminderStatus)

// Get upcoming expiry reminder
// GET
router.get('/upcoming-expiry',authenticateToken, upcomingExpiryReminder)

// get individual reminder history
// GET
router.get('/sent-reminders/:refNumber',authenticateToken, getReminderHistory)

// get all dashboard stats
// GET
router.get('/dashboard',authenticateToken, dashboardStats)

// export all reminders
// GET
router.get('/export',authenticateToken, exportAllReminders)

// category, employee list
// GET
router.get('/filter',authenticateToken, getEmployeeAndCategory)

router.get('/test-mail', async (req, res) => {

    const sendEmail = require('../services/mailService')

    const sent = await sendEmail({

        to: 'amanullamulla394@gmail.com',

        subject: 'Test Mail',

        html: '<h1>SMTP Working</h1>'
    })

    res.json({
        success: sent
    })
})

module.exports = router
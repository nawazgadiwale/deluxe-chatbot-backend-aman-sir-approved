const express = require('express')
const { createCategory, updateCategory, getindividualCategoryData, getAllCategoryList, deleteCategory, createReminder, updateReminder, getIndividualReminder, getAllReminderList, dashboardStats, updateReminderStatus, upcomingExpiryReminder, deleteReminder, exportAllReminders, bulkupdateReminderStatus, getReminderHistory, getEmployeeAndCategory } = require('../controllers/reminderController')
const router = express.Router()

// create category
// POST
router.post('/category', createCategory)

// update category
// PUT
router.put('/category/:catId', updateCategory)

// get individual category
// GET
router.get('/category/:catId', getindividualCategoryData)

// get all category 
// GET
router.get('/categories', getAllCategoryList)

// delete individual category
// DELETE
router.delete('/category/:catId', deleteCategory)

// create reminder
// POST
router.post('/reminder', createReminder)

// update reminder
// PUT
router.put('/reminder/:refNumber', updateReminder)

// get individual reminder
// GET
router.get('/reminder/:refNumber', getIndividualReminder)

// get all reminder list
// GET
router.get('/reminders', getAllReminderList)

// delete reminder
// DELETE
router.delete('/reminder/:refNumber', deleteReminder)

// Update reminder status
// PUT
router.put('/update-reminder-status/:refNumber', updateReminderStatus)

// Bulk update reminders
// POST
router.post('/bulk-update-status', bulkupdateReminderStatus)

// Get upcoming expiry reminder
// GET
router.get('/upcoming-expiry', upcomingExpiryReminder)

// get individual reminder history
// GET
router.get('/sent-reminders/:refNumber', getReminderHistory)

// get all dashboard stats
// GET
router.get('/dashboard', dashboardStats)

// export all reminders
// GET
router.get('/export', exportAllReminders)

// category, employee list
// GET
router.get('/filter', getEmployeeAndCategory)

module.exports = router
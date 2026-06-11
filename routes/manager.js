const express = require('express')
const { salesInvoices, stationerySalesInvoices, salesIndividualDetails, stationerySalesIndividualDetails, getCustomerDetails, stationeryGetCustomerDetails, getAllQuotes, salesIndividualQuoteDetails, getAllStationeryQuotes, ddaIndividualInvoiceInQuote, stationeryIndividualInvoiceInQuote, salesStationeryIndividualDetails, getCustomersData, getIndividualCustomerData } = require('../controllers/managerController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

router.get('/customers', authenticateToken, getCustomersData)

router.get('/sales-invoices', authenticateToken, salesInvoices)

router.get('/stationery-sales-invoices', authenticateToken, stationerySalesInvoices)

router.get('/sales-invoice/:id', authenticateToken, salesIndividualDetails)

router.get('/stationery-sales-invoices/:id', authenticateToken, stationerySalesIndividualDetails)

router.get('/customer/:id', authenticateToken, getCustomerDetails)

router.get('/stationery-customer/:id', authenticateToken, stationeryGetCustomerDetails)

router.get('/sales-quotes', authenticateToken, getAllQuotes)

router.get('/sales-quote/:id', authenticateToken, salesIndividualQuoteDetails)

router.get('/stationery-sales-quotes', authenticateToken, getAllStationeryQuotes)

router.get('/stationery-sales-quote/:id', authenticateToken, salesStationeryIndividualDetails)

router.get('/dda-invoices', authenticateToken, ddaIndividualInvoiceInQuote)

router.get('/stationery-invoices', authenticateToken, stationeryIndividualInvoiceInQuote)
module.exports = router
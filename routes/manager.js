const express = require('express')
const { salesInvoices, stationerySalesInvoices, salesIndividualDetails, stationerySalesIndividualDetails, getCustomerDetails, stationeryGetCustomerDetails, getAllQuotes, salesIndividualQuoteDetails, getAllStationeryQuotes, ddaIndividualInvoiceInQuote, stationeryIndividualInvoiceInQuote, salesStationeryIndividualDetails } = require('../controllers/managerController')
const router = express.Router()

router.get('/sales-invoices', salesInvoices)

router.get('/stationery-sales-invoices', stationerySalesInvoices)

router.get('/sales-invoice/:id', salesIndividualDetails)

router.get('/stationery-sales-invoices/:id', stationerySalesIndividualDetails)

router.get('/customer/:id', getCustomerDetails)

router.get('/stationery-customer/:id', stationeryGetCustomerDetails)

router.get('/sales-quotes', getAllQuotes)

router.get('/sales-quote/:id', salesIndividualQuoteDetails)

router.get('/stationery-sales-quotes', getAllStationeryQuotes)

router.get('/stationery-sales-quote/:id', salesStationeryIndividualDetails )

router.get('/dda-invoices', ddaIndividualInvoiceInQuote)

router.get('/stationery-invoices', stationeryIndividualInvoiceInQuote)
module.exports = router
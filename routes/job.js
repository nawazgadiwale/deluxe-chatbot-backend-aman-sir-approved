const express = require('express')
const { createNewOrder, getAllOrders, updateSalesData, getIndividualDetails, addOrUpdateDesignerDetails, addOrUpdateOperationDetails, addOrUpdateProductionDetails, updateMissingOperationDetails, addOrUpdateFinishingDetails, deleteOrder, createNewQuote, getAllSalesQuotes, getQuoteIndividualDetails, updateSalesQuoteData, getAllQuoteIds, salesInvoices } = require('../controllers/jobController')
const { default: upload } = require('../middlewares/multerConfig')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// router.get("/sales-invoices", salesInvoices)
// job order Route
// create new order
// POST
router.post("/order", authenticateToken, createNewOrder)

// update sales data 
// PUT
// router.put("/order/:uuid", updateSalesData)
router.put("/order/:quote_uuid", authenticateToken, updateSalesData)

// get all orders
// GET
router.get("/orders", authenticateToken, getAllOrders)

// get individual details of order
// GET
router.get("/order/:uuid", authenticateToken, getIndividualDetails)

// update designer data
// PUT
// router.put("/order/design/:uuid", upload.array("designImages"), addOrUpdateDesignerDetails)
router.put("/order/design/:quote_uuid", upload.array("designImages"), authenticateToken, addOrUpdateDesignerDetails)

// update production data
// PUT
// router.put("/order/production/:uuid", addOrUpdateProductionDetails)
router.put("/order/production/:quote_uuid", authenticateToken, addOrUpdateProductionDetails)

// update finishing data
// PUT
// router.put("/order/finishing/:uuid", addOrUpdateFinishingDetails)
router.put("/order/finishing/:quote_uuid", authenticateToken, addOrUpdateFinishingDetails)

// update operation data
// PUT
// router.put("/order/operation/:uuid", addOrUpdateOperationDetails)
router.put("/order/operation/:quote_uuid", authenticateToken, addOrUpdateOperationDetails)

// delete orders data
// DELETE
// router.delete("/order/:uuid", deleteOrder)
router.delete("/quote/:quote_uuid", authenticateToken, deleteOrder)

// add quotes data
// POST
router.post("/quote", authenticateToken, createNewQuote)

// get quotes data
// GET
router.get("/quotes", authenticateToken, getAllSalesQuotes)

// get quote data
// GET
router.get("/quote/:quote_uuid", authenticateToken, getQuoteIndividualDetails)

// update quote data
// PUT
router.put("/quote/:quote_uuid", authenticateToken, updateSalesQuoteData)

// get all quoteNumber
// GET
router.get("/quotes/numbers", authenticateToken, getAllQuoteIds)


module.exports = router
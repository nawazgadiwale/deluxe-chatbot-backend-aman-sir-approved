const express = require('express')
const { createNewOrder, getAllOrders, updateSalesData, getIndividualDetails, addOrUpdateDesignerDetails, addOrUpdateOperationDetails, addOrUpdateProductionDetails, updateMissingOperationDetails, addOrUpdateFinishingDetails, deleteOrder, createNewQuote, getAllSalesQuotes, getQuoteIndividualDetails, updateSalesQuoteData, getAllQuoteIds } = require('../controllers/jobController')
const { default: upload } = require('../middlewares/multerConfig')
const router = express.Router()

// job order Route
// create new order
// POST
router.post("/order", createNewOrder)

// update sales data 
// PUT
// router.put("/order/:uuid", updateSalesData)
router.put("/order/:quote_uuid", updateSalesData)

// get all orders
// GET
router.get("/orders", getAllOrders)

// get individual details of order
// GET
router.get("/order/:uuid", getIndividualDetails)

// update designer data
// PUT
// router.put("/order/design/:uuid", upload.array("designImages"), addOrUpdateDesignerDetails)
router.put("/order/design/:quote_uuid", upload.array("designImages"), addOrUpdateDesignerDetails)

// update production data
// PUT
// router.put("/order/production/:uuid", addOrUpdateProductionDetails)
router.put("/order/production/:quote_uuid", addOrUpdateProductionDetails)

// update finishing data
// PUT
// router.put("/order/finishing/:uuid", addOrUpdateFinishingDetails)
router.put("/order/finishing/:quote_uuid", addOrUpdateFinishingDetails)

// update operation data
// PUT
// router.put("/order/operation/:uuid", addOrUpdateOperationDetails)
router.put("/order/operation/:quote_uuid", addOrUpdateOperationDetails)

// delete orders data
// DELETE
// router.delete("/order/:uuid", deleteOrder)
router.delete("/quote/:quote_uuid", deleteOrder)

// add quotes data
// POST
router.post("/quote", createNewQuote)

// get quotes data
// GET
router.get("/quotes", getAllSalesQuotes)

// get quote data
// GET
router.get("/quote/:quote_uuid", getQuoteIndividualDetails)

// update quote data
// PUT
router.put("/quote/:quote_uuid", updateSalesQuoteData)

// get all quoteNumber
// GET
router.get("/quotes/numbers", getAllQuoteIds)


module.exports = router
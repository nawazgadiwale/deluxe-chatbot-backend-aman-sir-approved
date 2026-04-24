const express = require('express')
const router = express.Router()
const { getAllCustomerIds, addNewCustomerData, getAllCustomersListData } = require('../controllers/customerController')

router.post("/add", addNewCustomerData)


router.get("/ids", getAllCustomerIds)

router.get("/list", getAllCustomersListData)

module.exports = router
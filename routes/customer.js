const express = require('express')
const router = express.Router()
const { addNewCustomerData, getAllCustomersListData } = require('../controllers/customerController')

router.post("/add", addNewCustomerData)

router.get("/list", getAllCustomersListData)

module.exports = router
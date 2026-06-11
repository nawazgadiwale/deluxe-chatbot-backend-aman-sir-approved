const express = require('express')
const router = express.Router()
const { addNewCustomerData, getAllCustomersListData } = require('../controllers/customerController')
const authenticateToken = require('../middlewares/authMiddleware')

router.post("/add", authenticateToken, addNewCustomerData)

router.get("/list", authenticateToken, getAllCustomersListData)

module.exports = router
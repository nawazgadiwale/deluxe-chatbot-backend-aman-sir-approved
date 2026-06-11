const express = require('express')
const { addAllStegienceProducts, addAllJasaniProducts, getAllProducts, getIndividualProductDetails } = require('../controllers/productsController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// products Route
// get all stegience products
// POST
router.post("/stegience", authenticateToken, addAllStegienceProducts)

// get all jasani products
// POST
router.post("/jasani", authenticateToken, addAllJasaniProducts)

// get all products from exteranal sources
// GET
router.get("/all", authenticateToken, getAllProducts)

// get individual product details by uuid
// GET
router.get("/product/:uuid", authenticateToken, getIndividualProductDetails)

module.exports = router
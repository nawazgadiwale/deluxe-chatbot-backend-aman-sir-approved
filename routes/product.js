const express = require('express')
const { addAllStegienceProducts, addAllJasaniProducts, getAllProducts, getIndividualProductDetails } = require('../controllers/productsController')
const router = express.Router()

// products Route
// get all stegience products
// POST
router.post("/stegience", addAllStegienceProducts)

// get all jasani products
// POST
router.post("/jasani", addAllJasaniProducts)

// get all products from exteranal sources
// GET
router.get("/all", getAllProducts)

// get individual product details by uuid
// GET
router.get("/product/:uuid", getIndividualProductDetails)

module.exports = router
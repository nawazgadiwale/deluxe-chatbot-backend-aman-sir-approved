const express = require('express')
const { getReportsData, getMonthlyOrderGraph, getDivisionWiseGraph, getGraphDataBySalesPerson } = require('../controllers/reportController')
const router = express.Router()

// orders & employees reports data
// GET
router.get("/all", getReportsData)

// main sales graph per year
// GET
router.get("/main", getMonthlyOrderGraph)

// devision wise sales graph
// GET
router.get("/division", getDivisionWiseGraph)

// salesperson graph
// GET
router.get("/sales", getGraphDataBySalesPerson)

// exports
module.exports = router
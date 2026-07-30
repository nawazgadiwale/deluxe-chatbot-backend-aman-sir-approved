const express = require('express')
const authenticateToken = require('../middlewares/authMiddleware')
const { createSupplier, getAllSuppliers, getSupplierDetails, updateSupplier, deleteSupplier, addSupplierDetail, updateSupplierDetail, deleteSupplierDetail } = require('../controllers/supplierController')
const router = express.Router()

// Create a new Supplier
// POST
router.post('/new', authenticateToken, createSupplier)

// Get all suppliers 
// GET
router.get('/all', authenticateToken, getAllSuppliers)

// Get all the suppliers details
// GET
router.get('/:supplierId/details', authenticateToken, getSupplierDetails)

// Update suppliers data
// PUT
router.put('/edit/:supplierId', authenticateToken, updateSupplier)

// Delete suppliers data
// DELETE
router.delete('/delete/:supplierId', authenticateToken, deleteSupplier)

// Add supplier details for individual data
// POST
router.post('/:supplierId/details', authenticateToken, addSupplierDetail)

// update supplier details individually
// PUT
router.put('/:supplierId/details/:detailId', authenticateToken, updateSupplierDetail)

// delete supplier details individually
// DELETE
router.delete('/:supplierId/details/:detailId', authenticateToken, deleteSupplierDetail)

module.exports = router
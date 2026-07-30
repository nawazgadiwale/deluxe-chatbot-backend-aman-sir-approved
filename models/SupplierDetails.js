const mongoose = require('mongoose')

const supplierDetailSchema = new mongoose.Schema({
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    rfqNo: {
        type: Number,
        unique: true,
        required: true
    },
    quoteNumber: {
        type: Number
    },
    contactedDate: {
        type: Date
    },
    division: {
        type: String,
        enum: ['Signage', 'Stationery', 'Event (Digital)', 'Event (Fashion & Fabric)', 'Store Branding', 'Gifts', 'Gift & Stationery', 'N/A'],
        default: 'N/A'
    },
    productName: {
        type: String
    },
    productSize: {
        type: String
    },
    description: {
        type: String
    },
    quantity: {
        type: Number
    },
    unit: {
        type: String,
        enum: ['SQ/M', 'Yard', 'Roll', 'Pcs', 'Set', 'Other'],
        default: 'Other'
    },
    unitPrice: {
        type: Number
    },
    totalPrice: {
        type: Number
    },
    status: {
        type: String,
        enum: ['accepted', 'rejected', 'pending', 'new'],
        default: 'new'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('SupplierDetail', supplierDetailSchema)
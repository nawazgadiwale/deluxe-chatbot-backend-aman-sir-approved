const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sid: {
        type: Number,
        unique: true,
        required: true
    },
    contactPerson: {
        type: String,
    },
    companyName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String
    },
    emailId: {
        type: String
    },
    website: {
        type: String
    },
    address: {
        type: String
    },
    vatNumber: {
        type: Number
    },
    tradeLicence: {
        type: String
    },
}, {
    timestamps: true
})

module.exports = mongoose.model('Supplier', supplierSchema)
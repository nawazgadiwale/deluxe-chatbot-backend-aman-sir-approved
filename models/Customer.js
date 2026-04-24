const mongoose = require('mongoose')

const CustomerSchema = new mongoose.Schema({
    createdBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true
        },
    },
    customer_uuid: {
        type: String,
        unique: true,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    emailAddress: {
        type: String,
        required: true,
        unique: true
    },
    billingAddress: {
        type: String,
        required: true
    },
    totalInvoices: {
        type: Number,
        default: 0
    },
    totalQuotes: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['Paid', 'Overpaid', 'DueToday', 'DueYesterday', 'PaidInFull', 'Overdue', 'Pending'],
        default: 'Paid'
    },
    currency: {
        type: String,
        default: 'AED'
    },
    phoneNumber: {
        type: String
    },
    amount: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
})

/* ✅ DEFINE INDEX HERE */
CustomerSchema.index(
  { phoneNumber: 1 },
  { unique: true, partialFilterExpression: { phoneNumber: { $exists: true, $ne: null } } }
)

module.exports = mongoose.model('Customer', CustomerSchema)
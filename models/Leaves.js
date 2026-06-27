const mongoose = require('mongoose')

const leaveSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    fromDate: {
        type: Date,
        required: true
    },

    toDate: {
        type: Date,
        required: true
    },

    leaveDays: {
        type: Number,
        required: true
    },

    leaveCategory: {
        type: String,
        enum: ['Paid', 'UnPaid'],
        default: 'Paid'
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Leave', leaveSchema)
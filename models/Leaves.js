const mongoose = require('mongoose')

const leaveSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
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
    type: {
        type: String,
        enum: ['Half', 'Full'],
        default: 'Full'
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Leave', leaveSchema)
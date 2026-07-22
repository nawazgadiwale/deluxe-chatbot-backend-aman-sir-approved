const mongoose = require('mongoose')

const OtSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    otAddedDate: {
        type: Date,
        required: true
    },
    details: {
        type: String,
        required: true
    },
    otTime: {
        type: Number,
        required: true
    },
    jobOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('OT', OtSchema)
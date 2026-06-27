const mongoose = require('mongoose')

const sheetSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: 'true'
    },
    sheetNo: {
        type: Number,
        required: true,
        unique: true
    },
    sheetTitle: {
        type: String,
        required: true,
    },
    sheetCategory: {
        type: String,
        enum: ['SEO/Website', 'Digital Marketing', 'Sales', 'Design', 'Accounts', 'Managements', 'Customer Support'],
        default: 'Sales'
    },
    sheetLink: {
        type: String,
        required: true
    },
}, {
    timestamps: true
})

module.exports = mongoose.model('Sheet', sheetSchema)
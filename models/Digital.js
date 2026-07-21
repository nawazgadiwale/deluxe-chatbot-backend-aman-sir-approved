const mongoose = require('mongoose')

const digitalSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refNo: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    workDetails: {
        type: String,
        required: function () {
            return this.dayType === "Working-Day";
        },
        trim: true
    },
    dayType: {
        type: String,
        enum: [
            "Working-Day",
            "Leave",
            "Holiday",
        ],
        default: "Working-Day",
        required: true
    },
    team: {
        type: String,
        enum: ['Development', 'Designing', 'SEO', 'Marketing'],
    },
    status: {
        type: String,
        enum: ['Completed', 'In-Progress', 'Pending'],
        default: 'In-Progress'
    },
    remarks: {
        type: String,
        trim: true
    }
},
    {
        timestamps: true
    }
)

// Unique refNo per employee
digitalSchema.index(
    { employee: 1, refNo: 1 },
    { unique: true }
);

// Only one record per employee per day
digitalSchema.index(
    { employee: 1, date: 1 },
    { unique: true }
);

module.exports = mongoose.model('Digital', digitalSchema)
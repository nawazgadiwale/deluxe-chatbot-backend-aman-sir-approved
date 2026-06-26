const mongoose = require('mongoose')

const digitalSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    refNo: {
        type: Number,
        unique: true,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    workDetails: {
        type: String,
        workDetails: {
            type: String,
            required: function () {
                return ["Working-Day", "WFH"].includes(this.dayType);
            },
            trim: true
        },
        trim: true
    },
    dayType: {
        type: String,
        enum: [
            "Working-Day",
            "Leave",
            "Holiday",
            "WFH",
        ],
        default: "Working-Day",
        required: true
    },
    team: {
        type: String,
        enum: ['Developement', 'Designing', 'SEO', 'Marketing'],
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

digitalSchema.index(
    { employee: 1, refNo: 1 },
    { unique: true }
)

module.exports = mongoose.model('Digital', digitalSchema)
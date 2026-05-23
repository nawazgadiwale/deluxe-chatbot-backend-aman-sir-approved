const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    catId: {
        type: Number,
        unique: true,
        required: true
    },
    categoryName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    reminders: [
        {
            type: {
                type: String,
                enum: [
                    'due',
                    'critical',
                    'urgent',
                    'custom'
                ],
                required: true
            },
            daysBefore: {
                type: Number,
                required: true
            }
        }
    ],

    alertEnabled: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
})

categorySchema.pre('save', function (next) {
    const remindertypes = this.reminders.map(r => r.type)

    const requiredTypes = [
        'due',
        'critical',
        'urgent'
    ]

    const hasrequiredTypes = requiredTypes.every(type =>
        remindertypes.includes(type)
    )

    if (!hasrequiredTypes) {
        return next(
            new Error(
                'Due, Critical and Urgent reminders are mandatory'
            )
        )
    }

    next()
})

module.exports = mongoose.model('Category', categorySchema)
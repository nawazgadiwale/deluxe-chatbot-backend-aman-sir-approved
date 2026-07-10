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
                    'moderate',
                    'critical',
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
        'moderate',
        'critical'
    ]

    const hasrequiredTypes = requiredTypes.every(type =>
        remindertypes.includes(type)
    )

    if (!hasrequiredTypes) {
        return next(
            new Error(
                'Due, moderate and critical reminders are mandatory'
            )
        )
    }

    next()
})

module.exports = mongoose.model('Category', categorySchema)
const mongoose = require('mongoose')

const reminderSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    refNumber: {
        type: Number,
        required: true,
        unique: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null,
        required: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        required: true
    },
    description: {
        type: String,
        trim: true
    },
    expiryDate: {
        type: Date,
        required: true
    },
    notifyUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        required: true
    }],
    notes: {
        type: String,
        trim: true
    },
    reminderStatus: {
        type: String,
        enum: [
            'active',
            'inprogress',
            'completed',
            'overdue',
            'canceled'
        ],
        default: 'active',
        required: true
    },
    sentReminders: [
        {
            reminderType: {
                type: String
            },

            daysBefore: {
                type: Number
            },

            sentAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
},
    {
        timestamps: true
    })

module.exports = mongoose.model('Reminder', reminderSchema)

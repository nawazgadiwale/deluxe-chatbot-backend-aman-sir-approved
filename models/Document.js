const mongoose = require('mongoose')

const documentSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    documentNo: {
        type: Number,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: [
            "sheet",
            "document"
        ],
        required: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        required: true
    },
    googleFileId: {
        type: String,
        required: true
    },
    googleUrl: {
        type: String,
        required: true
    },
    permission: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastOpenedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    lastOpenedAt: {
        type: Date,
        default: null
    },
    viewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Document', documentSchema)
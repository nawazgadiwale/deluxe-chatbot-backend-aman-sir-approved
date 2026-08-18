const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false })

const conversationSchema = new mongoose.Schema({
    site: {
        type: String,
        enum: ['exprintmart', 'dlxprint'],
        required: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    visitor: {
        name: { type: String, default: null },
        phoneNumber: { type: String, default: null },
        emailId: { type: String, default: null },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
        pageUrl: { type: String, default: null } // page the chat widget was opened on
    },
    messages: [messageSchema],
    // Running structured extraction of lead info as the AI infers it across turns.
    // Kept separate from `visitor` above so we don't overwrite confirmed fields with guesses.
    extractedLead: {
        name: { type: String, default: null },
        companyName: { type: String, default: null },
        emailId: { type: String, default: null },
        phoneNumber: { type: String, default: null },
        billingAddress: { type: String, default: null },
        division: { type: String, default: null },
        products: [{ type: String }],
        initialRemartks: { type: String, default: null }
    },
    status: {
        type: String,
        enum: ['active', 'lead_captured', 'closed', 'abandoned'],
        default: 'active'
    },
    leadRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Data',
        default: null
    },
    leadCapturedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

conversationSchema.index({ site: 1, sessionId: 1 }, { unique: true })

module.exports = mongoose.model('Conversation', conversationSchema)

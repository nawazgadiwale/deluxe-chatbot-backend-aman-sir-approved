const mongoose = require('mongoose')

const dataSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    uid: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
    },
    emailId: {
        type: String,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    source: {
        type: String,
        enum: [
            'Oncall',
            'Walk-In',
            'Whatsapp',
            'Whatsapp-(Old)',
            'Whatsapp-(Re)',
            'Email',
            'Email-(Re)',
            'Google Ads-(Email)',
            'Google Ads-(Whatsapp)',
            'Google Ads Signage-(WA)',
            'Google Ads Events-(WA)',
            'Google Ads Events-(Email)',
            'Google Ads Sta-(WA)',
            'Google Ads Sta-(Email)',
            'Social Media',
            'Exprintmart-(Whatsapp)',
            'Exprintmart-(Email)'
        ],
        required: true,
    },
    division: {
        type: String,
        enum: ['Signage', 'Stationery', 'Event (Digital)', 'Event (Fashion & Fabric)', 'Store Branding', 'Gifts', 'Gift & Stationery'],
    },
    assignToSalesPerson: {
        type: String,
        enum: [
            'Admin', 'Aliasgar', 'Arif', 'Atif', 'Azmat', 'Huzaifa',
            'Junaid', 'Misba', 'Mohsin', 'Muazzam', 'Nayeem',
            'Nishan', 'Rizwan', 'Saniya', 'Salman', 'Sharifa',
            'Umair', 'Wajid', 'Ziyad', 'Zohaib'
        ],
        default: 'Admin',
        required: true,
    },
    dealStatus: {
        type: String,
        enum: ['New', 'Contacted', 'Quoted', 'Won', 'Lost'],
        default: 'New',
        required: true
    },
    dealAmount: {
        type: Number,
        default: 0,
    },
    quoteNumber: {
        type: Number,
        default: 0,
    },
    initialRemartks: {
        type: String,
    },
    leadAddedDate: {
        type: Date,
        default: Date.now,
        required: true
    },
    invoiceNumber: {
        type: Number,
        default: 0,
    },
    followUps: [
        {
            // follow up date are auto like if today is 22 then follow up date will be 25 (and next follow up date will be editable but default 25)
            followUpDate: {
                type: Date,
            },
            followUpTakenVia: {
                type: String,
                enum: ['Whatsapp', 'Email', 'Phone Call', 'Meeting', 'Other'],
            },
            adminName: {
                type: String,
                enum: ['Hafsa', 'Fariha', 'Jyoti', 'Mizba']
            },
            followUpNotes: {
                type: String
            }
        }
    ]
},
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('Data', dataSchema)
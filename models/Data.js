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
    billingAddress: {
        type: String,
        required: true
    },
    source: {
        type: String,
        enum: [
            'Oncall',
            'Walk-In',
            'WhatsApp',
            'WhatsApp-(Re)',
            'Email',
            'Email-(Re)',
            'Google Ads Signage-(WA)',
            'Google Ads Signage-(Email)',
            'Google Ads Events-(WA)',
            'Google Ads Events-(Email)',
            'Google Ads Sta-(WA)',
            'Google Ads Sta-(Email)',
            'Google Ads-(Re)',
            'Social Media-(DLX)',
            'Exprintmart-(WA)',
            'Exprintmart-(Email)',
            'Social Media-(Exprint)'
        ],
        required: true,
    },
    division: {
        type: String,
        enum: ['Signage', 'Stationery', 'Event (Digital)', 'Event (Fashion & Fabric)', 'Store Branding', 'Gifts', 'Gift & Stationery', 'N/A'],
        default: "N/A"
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
    products: [
        {
            productName: {
                type: String,
            },
            productId: {
                type: Number,
            }
        }
    ],
    dealStatus: {
        type: String,
        enum: ['Open', 'Contacted', 'Quoted', 'On-Going', 'No-reply', 'Won', 'Lost'],
        default: 'Open',
        required: true
    },
    dealAmount: {
        type: Number,
        default: 0,
    },
    // amountStatus: {
    //     type: String,
    //     enum: ['Paid', 'Unpaid'],
    //     default: 'Pending'
    // },
    quoteNumber: {
        type: Number,
        default: 0,
    },
    quoteDate: {
        type: Date,
    },
    // salesQuotes: {
    //     type: Number,
    //     default: 0
    // },
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
    invoiceDate: {
        type: Date,
    },
    // salesInvoices: {
    //     type: Number,
    //     default: 0
    // },
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
                enum: ['Hafsa', 'Fariha', 'Mizba', 'Aliasgar', 'Arif', 'Atif', 'Azmat', 'Huzaifa',
                    'Junaid', 'Misba', 'Mohsin', 'Muazzam', 'Nayeem',
                    'Nishan', 'Rizwan', 'Saniya', 'Salman', 'Sharifa',
                    'Umair', 'Wajid', 'Ziyad', 'Zohaib']
            },
            followUpNotes: {
                type: String
            },
            followUpGap: {
                type: Number,
                default: 0
            },
        }
    ]
},
    {
        timestamps: true,
    }
)

module.exports = mongoose.model('Data', dataSchema)
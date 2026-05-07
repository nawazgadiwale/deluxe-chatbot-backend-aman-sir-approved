const mongoose = require('mongoose')

// Quote Schema
const quoteSchema = new mongoose.Schema({
    createdBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: true
        },
    },
    quote_uuid: {
        type: String,
        unique: true,
        required: true
    },
    quoteNumber: {
        type: Number,
        required: true,
        unique: true
    },
    quoteDate: {
        type: String,
        required: true,
    },
    main_category: {
        type: String,
        enum: ['Digital', 'Stationery'],
        required: true
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
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    contactPerson: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    emailId: {
        type: String,
        required: true
    },
    item: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    // department: {
    //     type: String,
    //     required: true
    // },
    division: {
        type: String,
        required: true
    },
    billingAddress: {
        type: String,
        required: true,
    },
    deliveryAddress: {
        type: String,
    },
    type: {
        type: String,
        enum: ['B2B', 'B2C', 'Individual'],
        required: true
    },
    salesPerson: {
        type: String,
        enum: ['Huzaifa', 'Aliasgar', 'Nishan', 'Rizwan', 'Arif', 'Nayeem', 'Azmat', 'Ziyad',
            'Umair', 'Wajid', 'Junaid', 'Zohaib', 'Saniya', 'Mohsin',
            'Misba', 'Muazzam', 'Sharifa', 'Salman', 'Atif'
        ],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currencyType: {
        type: String,
        enum: ['AED'],
        required: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Accepted', 'Rejected'],
        default: 'Active'
    },
    dealStatus: {
        type: String,
        enum: ['Open', 'Proposal', 'Followup', 'Draft', 'Payment', 'Delivery/Collection', 'Win', 'Lost', 'Win-Follow up'],
        default: 'Proposal'
    },
    multipleItems: {
        type: [String],
        default: []
    },
    // salesStatus: {
    //     type: String,
    //     enum: ['Quote', 'Invoice'],
    //     default: "Quote"
    // }
    moveToInvoice: {
        type: Boolean,
        default: false
    },
    assignToDepartment: {
        type: String,
        enum: ["Sales", "Designer", "Production", "Finishing", "Operation"],
        default: "Sales",
        required: true
    },
    emirates: {
        type: String,
        enum: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Sharjah', 'Ras al Khaimah', 'Umm al Quwain', 'International'],
        required: true,
        default: 'Dubai'
    },
    paymentStatus: {
        type: String,
        enum: ['DueToday', 'DueYesterday', 'PaidInFull', 'Overdue'],
        // required: true,
        default: 'DueToday'
    },
    deliveryDate: {
        type: Date
    },
    deliveryTime: {
        type: String
    },
    modes: {
        type: String,
        enum: ['Collection', 'Delivery', 'Installation', 'Courier-Porter', 'Courier-Jeebly', 'Courier-Runway', 'Courier-Outsource'],
        default: 'Collection'
    },
    outsourcePersonName: {
        type: String,
        default: null
    },
    outsourcePersonNumber: {
        type: String,
        default: null
    },
    designer: {
        type: String,
    },
    designers: {
        type: [String],
        default: []
    },
    description: {
        type: String
    },
    finishingInstruction: {
        type: String
    },
    instruction: {
        type: String
    },
    invoiceNumber: {
        type: Number,
    },
    invoiceDate: {
        type: Date
    },
    draftDate: {
        type: Date,
    },
    proceedDate: {
        type: Date
    },
    filePath: {
        type: String
    },
    draftSource: {
        type: String
    },
    extraInstruction: {
        type: String
    },
    proceedMultipleItems: {
        type: String
    },
    production_departments: {
        type: [String],
        default: []
    },
    designImages: {
        type: [String],
        default: []
    },
    recievedDate: {
        type: Date,
    },
    size: {
        type: String
    },
    quantity: {
        type: Number
    },
    printer: {
        type: String
    },
    completionDate: {
        type: Date
    },
    materialDetails: {
        type: String
    },
    finishingDetails: {
        type: String
    },
    machine: {
        type: String
    },
    media: {
        type: String
    },
    finishing: {
        type: String
    },
    finishingRecieveDate: {
        type: Date
    },
    finishingCompletionDate: {
        type: Date
    },
    operation: {
        type: String
    },
    operationDate: {
        type: Date
    },
    operationTime: {
        type: String
    },
    // operationArea: {
    //     type: String
    // },
    team: {
        type: String
    },
    productionDetails: {
        type: String
    },
    remarks: {
        type: String
    },
    packagingInstruction: {
        type: String
    },
    isOperationCompleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

module.exports = mongoose.model('Quote', quoteSchema)
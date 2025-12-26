const mongoose = require('mongoose')

// Job Schema
const jobSchema = new mongoose.Schema({
    // who created job
    createdBy: {
        // job creater user id
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        // job creater name
        name: {
            type: String,
            required: true
        }
    },
    // storing uniquie from manager.io as uuid
    uuid: {
        type: String,
        unique: true,
        required: true
    },
    // invoice number from manager.io
    invoiceNumber: {
        type: Number,
        required: true,
        unique: true
    },
    // invoice date from manager.io
    invoiceDate: {
        type: String,
        required: true
    },
    // main category from static
    main_category: {
        type: String,
        enum: ['Digital', 'Stationery'],
        required: true
    },
    // emirates from manager.io
    emirates: {
        type: String,
        enum: ['Abu Dhabi', 'Ajman', 'Dubai', 'Fujairah', 'Sharjah', 'Ras al Khaimah', 'Umm al Quwain', 'International'],
        required: true
    },
    // category from sales
    category: {
        type: String,
        required: true
    },
    // contact person from manager.io
    contact_person: {
        type: String,
        required: true
    },
    // division from manager.io
    division: {
        type: String,
        enum: ['Store Branding', 'Signage', 'Event (Fashion & Fabric)', 'Event (Digital)', 'Gift', 'Stationery', 'Gifts', 'Gift & Stationery', 'Other'],
        required: true
    },
    // email id from manager.io
    emailId: {
        type: String,
        required: true
    },
    // item from manager.io
    item: {
        type: String,
        required: true
    },
    // sales person from manager.io
    salesPerson: {
        type: String,
        enum: ['Huzaifa', 'Aliasgar', 'Nishan', 'Rizwan', 'Arif', 'Nayeem', 'Azmat', 'Ziyad',
            'Umair', 'Wajid', 'Junaid', 'Zohaib', 'Saniya', 'Mohsin', 'Aaliya', 'Zeedan', 'Misba',
            'Muazzam', 'Hafsa', 'Sharifa', 'Salman'
        ],
        required: true
    },
    // source from manager.io
    source: {
        type: String,
        enum: ['Whatsapp', 'Whatsapp(Old)', 'Email', 'Google Ads (Email)', 'Google Ads (WhatsApp)', 'Social Media', 'Walk-In', 'Whatsapp - Re',
            'Email - Re', 'Exprintmart -Whatsapp', 'Exprintmart- Email', 'Event Ad (Email)', 'Event Ad (WhatsApp)', 'Repeat', 'Events (Google Ads)'],
        required: true
    },
    // type from manager.io
    type: {
        type: String,
        enum: ['B2C', 'B2B', 'Individual'],
        required: true
    },
    // modes set by sales person
    modes: {
        type: String,
        enum: ['Collection', 'Delivery', 'Installation', 'Courier-Porter', 'Courier-Jeebly', 'Courier-Runway'],
        required: true,
    },
    // mobile number from manager.io
    mobileNo: {
        type: String,
        required: true
    },
    // billing address from manager.io if not fill by sales person
    billing_address: {
        type: String,
        required: true
    },
    // multiple items filled by sales person storing the items in array
    multiple_items: {
        type: [String],
        default: []
    },
    // delivery address from manager.io if not same as billing address if not then fill by sales person
    delivery_address: {
        type: String,
        required: true
    },
    // payment status
    payment_status: {
        type: String,
        enum: ['DueToday', 'DueYesterday', 'PaidInFull', 'Overdue', 'N/A'],
        required: true
    },
    // delivery date 
    delivery_date: {
        type: Date,
    },
    // delivery time
    delivery_time: {
        type: String,
    },
    // finishing instruction
    finishing_instruction: {
        type: String,
    },
    // assign to department is assign by sales person
    assignToDepartment: {
        type: String,
        enum: ['Sales','Designer', 'Production', 'Finishing', 'Operation', 'Completed'],
        default: 'Sales',
        required: true
    },
    // designer person selected by salesperson
    designer: {
        type: String,
        required: true
    },
    // assign production selected by design person
    assign_to_production: {
        type: [String],
        default: []
    },
    // production person selected by design person
    production: {
        type: String,
    },
    // finishing person selected by production person
    finishing: {
        type: String,
    },
    // operation person selected by production person
    operation: {
        type: String,
    },
    // company name from manager.io with individual api from key
    companyName: {
        type: String,
        required: true
    },
    // description filled by sales person
    description: {
        type: String
    },
    // instruction filled by sales person
    instruction: {
        type: String
    },
    // draft date filled by design person
    draftDate: {
        type: Date
    },
    // proceed date filled by design person
    proceedDate: {
        type: Date
    },
    // design images filled by design person
    designImages: {
        type: [String],
        default: []
    },
    // designer description filled by design person
    // designerDescription: {
    //     type: String
    // },
    // extra instruction filled by design person
    extra_instruction: {
        type: String,
    },
    draft_source: {
        type: String,
        enum: ['WhatsApp', 'Telegram', 'N/A'],
        default: 'N/A'
    },
    // production department assign
    production_departments: {
        type: [String],
        default: []
    },
    // proceed multiple items from design person
    proceed_multiple_items: {
        type: String,
    },
    // modes details selected by sales person
    // modesDetails: {
    //     type: String
    // },
    // file path url filled by design person from our image server
    filePath: {
        type: String
    },
    // recieve date filled by production person
    recievedDate: {
        type: Date,
    },
    // size filled by production person
    size: {
        type: String
    },
    // quantity filled by production person
    quantity: {
        type: Number
    },
    // media filled by production person
    media: {
        type: String
    },
    // printer filled by production person
    printer: {
        type: String
    },
    // completion date filled by production person
    completionDate: {
        type: Date
    },
    // material details filled by production person
    materialDetails: {
        type: String
    },
    // finishing details filled by production person
    finishingDetails: {
        type: String
    },
    // machine details filled by production person
    machine: {
        type: String,
    },
    // operation date filled by operation person
    operationDate: {
        type: Date,
    },
    // operation time in minutes filled by operation person
    operationTime: {
        type: Number
    },
    // operation area filled by operation person
    operationArea: {
        type: String
    },
    // team filled by operation person
    team: {
        type: String
    },
    // production details filled by operation person
    productionDetails: {
        type: String
    },
    // remarks filled by operation person
    remarks: {
        type: String
    },
    // packaging instruction filled by operation team
    packagingInstruction: {
        type: String,
    },
    // marking job completed by operqation person
    isOperationCompleted: {
        type: Boolean,
        default: false
    }
}, {
    // storing timestamps like created at and updated at 
    timestamps: true
})

module.exports = mongoose.model('Job', jobSchema)
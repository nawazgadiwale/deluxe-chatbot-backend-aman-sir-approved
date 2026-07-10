const mongoose = require('mongoose')

const folderSchema = new mongoose.Schema({
    createdBy: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: true
    },
    folderNo: {
        type: Number,
        unique: true
    },
    folderName: {
        type: String,
        required: true,
        trim: true
    },
    // parent folder in our crm
    parentFolder:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    },
    // google parent folder id
    googleParentFolderId: {
        type: String,
        default: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
    },
    // Current folder Id in google drive
    googleFolderId: {
        type: String,
        required: true
    },
    googleFolderUrl: {
        type: String,
        required: true
    },
    permission: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }]
}, {
    timestamps: true
})

module.exports = mongoose.model('Folder', folderSchema)
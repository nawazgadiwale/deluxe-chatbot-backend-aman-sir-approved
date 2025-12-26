const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

// User Schema
const UserSchema = new mongoose.Schema({
    // name of employee or user
    name: {
        type: String,
        required: true
    },
    // password
    password: {
        type: String,
        required: true
    },
    // re_password
    re_password: {
        type: String,
        required: true
    },
    // employee email
    email: {
        type: String,
        required: true,
        unique: true
    },
    // employee phone
    phone: {
        type: String,
        required: true,
        unique: true
    },
    // role of employee
    role: {
        type: String,
        enum: ['admin', 'sub-admin', 'sales', 'design', 'production', 'finishing', 'operation'],
        default: 'sales'
    },
    // access of employee
    access: {
        type: [String],
        default: []
    },
    // created by ref to User Id of Admin (who created this user)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
},
    {
        // storing time stamps like created at and updated at 
        timestamps: true
    })

// Middleware for Hashing password before using
UserSchema.pre('save', async function (next) {

    if (!this.access || this.access.length === 0) {
        this.access = [this.name]
    }

    if (!this.isModified('password')) return next

    try {
        // hash the password and store and move to next
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
        next()
    } catch (error) {
        // if something goes wrong
        next(error)
    }
})

// compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', UserSchema)
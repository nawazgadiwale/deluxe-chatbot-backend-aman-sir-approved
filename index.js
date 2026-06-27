require("dotenv").config();
const path = require('path')
const express = require('express')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const cors = require('cors')

const authRoutes = require("./routes/auth")
const jobRoutes = require("./routes/job")
const reportRoutes = require("./routes/report")
const curstomerRoutes = require("./routes/customer")
const managerioRoutes = require("./routes/manager")
const dataRoutes = require("./routes/data")
const reminderRoutes = require("./routes/reminder")
const sheetsRoutes = require('./routes/sheet')

const app = express()
app.use(express.json())
app.use(cors())

// auth routes
app.use("/v1/api/auth", authRoutes)

// order / job routes
app.use("/v1/api/job", jobRoutes)

// reports routes
app.use("/v1/api/report", reportRoutes)

// customer routes
app.use("/v1/api/customer", curstomerRoutes)

// manager io routes
app.use("/v1/api/managerio", managerioRoutes)

// data management routes
app.use("/v1/api/data", dataRoutes)

// reminder module routes
app.use("/v1/api/reminder", reminderRoutes)

// sheets routs
app.use('/v1/api/sheets', sheetsRoutes)

// static folder for uploads
app.use("/uploads", express.static(path.join(process.cwd(), 'uploads')))

// Load CRON
require('./cron/expiredReminderCron')
require('./cron/emailSendReminderCron')

// connect to our database
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('MongoDB Connected!'))
.catch(() => console.log('Failed To Connect DB...'))

const PORT = process.env.PORT

app.listen(PORT, () => console.log(`Server Running on port ${PORT} for Deluxe Management`))
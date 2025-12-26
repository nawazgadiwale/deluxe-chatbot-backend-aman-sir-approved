const path = require('path')
const express = require('express')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const cors = require('cors')

const authRoutes = require("./routes/auth")
const jobRoutes = require("./routes/job")
const reportRoutes = require("./routes/report")
const productRoutes = require("./routes/product")
dotenv.config()

const app = express()
app.use(express.json())
app.use(cors())

// auth routes
app.use("/v1/api/auth", authRoutes)

// order / job routes
app.use("/v1/api/job", jobRoutes)

// reports routes
app.use("/v1/api/report", reportRoutes)

// products routes
app.use("/v1/api/products", productRoutes)

// static folder for uploads
app.use("/uploads", express.static(path.join(process.cwd(), 'uploads')))

// connect to our database
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('MongoDB Connected!'))
.catch(() => console.log('Failed To Connect DB...'))

const PORT = process.env.PORT

app.listen(PORT, () => console.log(`Server Running on port ${PORT} for Deluxe Management`))
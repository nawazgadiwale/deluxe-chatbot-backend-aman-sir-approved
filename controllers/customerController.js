const Customer = require("../models/Customer")

const mongoose = require('mongoose')
const Data = require("../models/Data")

const addNewCustomerData = async (req, res) => {
    try {
        const {
            customer_uuid,
            companyName,
            emailAddress,
            billingAddress,
            currencyType,
            amount,
            status,
            createdBy
        } = req.body

        if (!customer_uuid || !companyName || !billingAddress || !status) {
            return res.status(400).json({ success: false, message: 'Missing required fields' })
        }

        // ✅ NEW VALIDATION
        if (!createdBy?.userId || !createdBy?.name) {
            return res.status(400).json({
                success: false,
                message: 'createdBy userId and name are required'
            })
        }

        const existinguuid = await Customer.findOne({ customer_uuid })
        if (existinguuid) {
            return res.status(400).json({ message: "The Customer is Already Created!" })
        }

        const newCustomerData = {
            createdBy: {
                userId: new mongoose.Types.ObjectId(createdBy.userId),
                name: createdBy.name
            },
            customer_uuid,
            companyName,
            emailAddress,
            billingAddress,
            currency: currencyType,
            amount,
            status
        }

        // ✅ Only add if exists
        if (req.body.phoneNumber) {
            newCustomerData.phoneNumber = req.body.phoneNumber
        }

        const newCustomer = new Customer(newCustomerData)
        await newCustomer.save()
        return res.status(201).json({
            success: true,
            message: 'Customer added successfully'
        })

    } catch (error) {
        console.error('Error in addNewCustomerData:', error)
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}


const getAllCustomersListData = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = "" } = req.query

        const pipeline = []
        if (search) {
            if (!isNaN(search)) {
                pipeline.push({
                    $match: {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$phoneNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    }
                })
            } else {
                pipeline.push({
                    $match: {
                        $or: [
                            { companyName: { $regex: search, $options: "i" } },
                            { emailAddress: { $regex: search, $options: "i" } },
                            { billingAddress: { $regex: search, $options: "i" } },
                            { status: { $regex: search, $options: "i" } },
                        ]
                    }
                })
            }
        }

        pipeline.push({ $sort: { createdAt: -1 } })
        pipeline.push({ $skip: (page - 1) * parseInt(limit) })
        pipeline.push({ $limit: parseInt(limit) })

        const customers = await Customer.aggregate(pipeline)
        const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage))
        countPipeline.push({ $count: "total" })

        const countResult = await Customer.aggregate(countPipeline)
        const total = countResult.length > 0 ? countResult[0].total : 0

        res.status(200).json({
            success: true,
            message: "Customers Data!",
            data: customers,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        })
    } catch (error) {
        console.error('Error getting customers:', error.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

module.exports = { addNewCustomerData, getAllCustomersListData }
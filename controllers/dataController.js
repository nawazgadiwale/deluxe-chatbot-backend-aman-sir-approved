const Counter = require('../models/Counter')
const Data = require('../models/Data')

// next invoice number
const getNextInvoiceNumber = async () => {

    const counter = await Counter.findOneAndUpdate(
        { key: 'invoice' },
        { $inc: { value: 1 } },
        {
            new: true,
            upsert: true
        }
    )

    // Format number with leading zeros
    const formattedNumber = String(counter.value).padStart(10, '0')

    return `INV-${formattedNumber}`
}

// next reference number
const getNextRefNumber = async () => {
    const counter = await Counter.findOneAndUpdate(
        { key: 'refNo' },
        { $inc: { value: 1 } },
        {
            new: true,
            upsert: true
        }
    )

    return counter.value
}

// Add new lead data
const addNewLeadData = async (req, res) => {
    try {
        const uid = req.body.uid || await getNextInvoiceNumber()
        const refNo = await getNextRefNumber()

        const {
            createdBy,
            name,
            companyName,
            phoneNumber,
            emailId,
            source,
            division,
            assignToSalesPerson,
            dealStatus,
            dealAmount,
            quoteNumber,
            initialRemartks,
            leadAddedDate,
            invoiceNumber,
            products,
            // amountStatus,
            // salesQuotes,
            quoteDate,
            invoiceDate,
            // salesInvoices,
            billingAddress,
            assignFollowUp,
            followUpInstruction
            // followUpDate
        } = req.body

        if (
            !refNo,
            !createdBy ||
            !name ||
            !phoneNumber ||
            !source ||
            !assignToSalesPerson ||
            !dealStatus ||
            !leadAddedDate ||
            !assignFollowUp
        ) {
            return res.status(400).json({
                message: "All required fields must be filled!"
            })
        }

        const existingUid = await Data.findOne({ uid })

        if (existingUid) {
            return res.status(400).json({
                message: "The Lead is Already Created!"
            })
        }

        const leadDate = new Date(leadAddedDate)

        // const finalFollowUpDate = followUpDate
        //     ? new Date(followUpDate)
        //     : new Date(leadDate.getTime() + 3 * 24 * 60 * 60 * 1000)

        const newLead = new Data({
            refNo,
            createdBy,
            uid,
            name,
            companyName,
            phoneNumber,
            emailId,
            source,
            division,
            dealAmount,
            assignToSalesPerson,
            dealStatus,
            quoteNumber,
            initialRemartks,
            leadAddedDate,
            invoiceNumber,
            products,
            // amountStatus,
            // salesQuotes,
            quoteDate,
            invoiceDate,
            // salesInvoices,
            billingAddress,
            assignFollowUp,
            followUpInstruction
            // followUps: [
            //     {
            //         followUpDate: finalFollowUpDate
            //     }
            // ]
        })

        const saveLead = await newLead.save()

        res.status(200).json({
            success: true,
            message: "New Lead Added successfully!",
            lead: saveLead
        })

    } catch (error) {
        console.error('Error creating lead', error.message)
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

const getAllCustomerIds = async (req, res) => {
    try {
        const { customerIds } = req.body

        const existingCustomers = await Data.find(
            {
                uid: { $in: customerIds },
            },
            { uid: 1 }
        )
        return res.status(200).json({
            success: true,
            customerIds: existingCustomers.map(item => item.uid)
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

// Update new lead data
const updateLeadData = async (req, res) => {
    try {
        const { uid } = req.params

        const {
            name,
            companyName,
            phoneNumber,
            emailId,
            dealAmount,
            source,
            division,
            assignToSalesPerson,
            dealStatus,
            quoteNumber,
            initialRemartks,
            leadAddedDate,
            invoiceNumber,
            products,
            adminName,
            quoteDate,
            invoiceDate,
            billingAddress,
            assignFollowUp,
            followUpInstruction
        } = req.body

        const lead = await Data.findOne({ uid })

        if (!lead) {
            return res.status(404).json({
                message: "Lead not found"
            })
        }

        if (name !== undefined) {
            lead.name = name
        }

        if (companyName !== undefined) {
            lead.companyName = companyName
        }

        if (phoneNumber !== undefined) {
            lead.phoneNumber = phoneNumber
        }

        if (emailId !== undefined) {
            lead.emailId = emailId
        }

        if (dealAmount !== undefined) {
            lead.dealAmount = dealAmount
        }

        if (source !== undefined) {
            lead.source = source
        }

        if (division !== undefined) {
            lead.division = division
        }

        if (assignToSalesPerson !== undefined) {
            lead.assignToSalesPerson = assignToSalesPerson
        }

        if (dealStatus !== undefined) {
            lead.dealStatus = dealStatus
        }

        if (quoteNumber !== undefined) {
            lead.quoteNumber = quoteNumber
        }

        if (initialRemartks !== undefined) {
            lead.initialRemartks = initialRemartks
        }

        if (leadAddedDate !== undefined) {
            lead.leadAddedDate = leadAddedDate
        }

        if (invoiceNumber !== undefined) {
            lead.invoiceNumber = invoiceNumber
        }

        if (products !== undefined) {
            lead.products = products
        }

        if (quoteDate !== undefined) {
            lead.quoteDate = quoteDate
        }

        if (invoiceDate !== undefined) {
            lead.invoiceDate = invoiceDate
        }

        if (billingAddress !== undefined) {
            lead.billingAddress = billingAddress
        }

        if (assignFollowUp !== undefined) {
            lead.assignFollowUp = assignFollowUp
        }

        if (followUpInstruction !== undefined) {
            lead.followUpInstruction = followUpInstruction
        }

        await lead.save()

        res.status(200).json({
            success: true,
            message: "Lead updated successfully",
            lead
        })
    } catch (error) {
        console.error("Error updating lead:", error.message)
        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Update first followup date
const updateFirstFollowupdate = async (req, res) => {
    try {
        const { uid } = req.params
        const { followUpDate } = req.body
        console.log(req.body)
        console.log(typeof req.body)
        if (!followUpDate) {
            return res.status(400).json({
                message: "Follow-up date is required"
            })
        }

        const lead = await Data.findOne({ uid })

        if (!lead) {
            return res.status(404).json({
                message: "Lead not found"
            })
        }



        // if first followup already exists -> update it
        if (lead.followUps.length > 0) {
            lead.followUps[0].followUpDate = new Date(followUpDate)
        } else {
            // create first followup object
            lead.followUps.push({
                followUpDate: new Date(followUpDate)
            })
        }

        await lead.save()

        res.status(200).json({
            success: true,
            message: "First follow-up updated successfully",
            lead
        })

    } catch (error) {
        console.error("Error updating first followup date:", error.message)

        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Get all lead data with filters
const getAllLeadsData = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            source,
            dealStatus,
            assignToSalesPerson,
            division,
            adminName,
            year,
            month,
            startDate,
            endDate,
            assignFollowUp,
            dateFilterType = 'leadAddedDate',
            minDealAmount,
            maxDealAmount
        } = req.query

        const now = new Date()

        const filterYear = parseInt(year) || now.getFullYear()
        const filterMonth = parseInt(month) || (now.getMonth() + 1)

        // const startDate = new Date(filterYear, filterMonth - 1, 1)
        // const endDate = new Date(filterYear, filterMonth, 1)

        // const baseMatch = {
        //     leadAddedDate: {
        //         $gte: startDate,
        //         $lt: endDate
        //     }
        // }

        let baseMatch = {}
        const dateField = ["leadAddedDate", "quoteDate", "invoiceDate"].includes(dateFilterType)
            ? dateFilterType
            : 'leadAddedDate'

        if (startDate && endDate) {
            const start = new Date(`${startDate}T00:00:00.000Z`);
            const end = new Date(`${endDate}T23:59:59.999Z`);

            // baseMatch.leadAddedDate = {
            //     $gte: start,
            //     $lte: end,
            // };
            baseMatch[dateField] = {
                $gte: start,
                $lte: end
            }

        } else {
            const monthStartDate = new Date(filterYear, filterMonth - 1, 1)
            const monthEndDate = new Date(filterYear, filterMonth, 1)

            baseMatch.leadAddedDate = {
                $gte: monthStartDate,
                $lt: monthEndDate
            }
        }

        if (search) {
            if (!isNaN(search)) {
                baseMatch.$or = [
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$refNo" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$invoiceNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$quoteNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$phoneNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        products: {
                            $elemMatch: {
                                productId: Number(search)
                            }
                        }
                    }
                ]
            } else {
                baseMatch.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } },
                    { emailId: { $regex: search, $options: "i" } },
                    {
                        "products.productName": {
                            $regex: search,
                            $options: "i"
                        }
                    },

                ]
            }
        }

        // if (source) baseMatch.source = source
        // if (dealStatus) baseMatch.dealStatus = dealStatus
        // if (assignToSalesPerson) baseMatch.assignToSalesPerson = assignToSalesPerson
        // if (division) baseMatch.division = division

        const sourceArray = source ? source.split(",") : []
        const dealStatusArray = dealStatus ? dealStatus.split(",") : []
        const salesPersonArray = assignToSalesPerson ? assignToSalesPerson.split(",") : []
        const divisionArray = division ? division.split(",") : []
        const adminArray = adminName ? adminName.split(",") : []
        const assignFollowUpArray = assignFollowUp ? assignFollowUp.split(",") : []



        if (sourceArray.length > 0) {
            baseMatch.source = {
                $in: sourceArray
            }
        }

        if (dealStatusArray.length > 0) {
            baseMatch.dealStatus = {
                $in: dealStatusArray
            }
        }

        if (salesPersonArray.length > 0) {
            baseMatch.assignToSalesPerson = {
                $in: salesPersonArray
            }
        }

        if (divisionArray.length > 0) {
            baseMatch.division = {
                $in: divisionArray
            }
        }

        if (assignFollowUpArray.length > 0) {
            baseMatch.assignFollowUp = {
                $in: assignFollowUpArray
            };
        }

        const hasMin = minDealAmount !== undefined && minDealAmount !== "";
        const hasMax = maxDealAmount !== undefined && maxDealAmount !== "";

        if (hasMin || hasMax) {
            baseMatch.dealAmount = {};

            if (hasMin) {
                baseMatch.dealAmount.$gte = Number(minDealAmount);
            }

            if (hasMax) {
                baseMatch.dealAmount.$lte = Number(maxDealAmount);
            }
        }

        const pipeline = [
            { $match: baseMatch },

            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy'
                }
            },
            {
                $unwind: {
                    path: '$createdBy',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $addFields: {
                    createdBy: "$createdBy.name"
                }
            },

        ]
        if (adminArray.length > 0) {
            pipeline.push({
                $match: {
                    createdBy: {
                        $in: adminArray
                    }
                }
            })
        }

        const countPipeline = [
            { $match: baseMatch },

            {
                $lookup: {
                    from: 'users',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy'
                }
            },

            {
                $unwind: {
                    path: '$createdBy',
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $addFields: {
                    createdBy: "$createdBy.name"
                }
            }
        ]

        if (adminArray.length > 0) {
            countPipeline.push({
                $match: {
                    createdBy: {
                        $in: adminArray
                    }
                }
            })
        }

        countPipeline.push({
            $count: "total"
        })

        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        )

        const leads = await Data.aggregate(pipeline)

        // const countPipeline = [
        //     { $match: baseMatch },
        //     { $count: "total" }
        // ]

        const countResult = await Data.aggregate(countPipeline)
        const total = countResult.length > 0 ? countResult[0].total : 0

        res.status(200).json({
            success: true,
            message: "Leads Data!",
            data: leads,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            month: filterMonth,
            year: filterYear
        })

    } catch (error) {
        console.error('Error getting leads:', error.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// Global search with filters for all leads data
const getGlobalSearchAllLeadsData = async (req, res) => {
    try {
        const {
            search = "",
            limit = 10
        } = req.query

        const limitNumber = parseInt(limit) || 10

        let baseMatch = {}

        // Search Filter
        if (search) {
            if (!isNaN(Number(search))) {
                baseMatch.$or = [
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$refNo" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$invoiceNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$quoteNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$phoneNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        products: {
                            $elemMatch: {
                                productId: Number(search)
                            }
                        }
                    }
                ]
            } else {
                baseMatch.$or = [
                    {
                        name: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        companyName: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        emailId: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        "products.productName": {
                            $regex: search,
                            $options: "i"
                        }
                    }
                ]
            }
        }

        const pipeline = [
            {
                $match: baseMatch
            },
            {
                $lookup: {
                    from: "users",
                    localField: "createdBy",
                    foreignField: "_id",
                    as: "createdBy"
                }
            },
            {
                $unwind: {
                    path: "$createdBy",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $addFields: {
                    createdBy: "$createdBy.name"
                }
            }
        ]

        pipeline.push(
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $limit: limitNumber
            }
        )

        const leads = await Data.aggregate(pipeline)

        return res.status(200).json({
            success: true,
            message: "Leads Data!",
            total: leads.length,
            limit: limitNumber,
            data: leads
        })

    } catch (error) {
        console.error("Error getting leads:", error)

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}
// Get individual lead data
const getIndividualLeadData = async (req, res) => {
    try {
        const { uid } = req.params

        if (!uid) {
            return res.status(400).json({ message: "UID is required" })
        }

        const lead = await Data.findOne({ uid }).lean()

        if (!lead) {
            return res.status(404).json({ message: "Lead not found!" })
        }

        return res.status(200).json(lead)
    } catch (error) {
        console.error("Error fetching individual lead:", error)
        return res.status(500).json({ message: "Internal server error" })
    }
}

// Add followup data
const addFollowUp = async (req, res) => {
    try {
        const { uid } = req.params

        const {
            followUpDate,
            followUpTakenVia,
            adminName,
            followUpNotes,
            clientResponse
        } = req.body

        const lead = await Data.findOne({ uid })

        if (!lead) {
            return res.status(404).json({
                message: "Lead not found"
            })
        }

        const pendingIndex = lead.followUps.findLastIndex(
            (f) =>
                f.followUpDate &&
                !f.followUpTakenVia &&
                !f.followUpNotes &&
                !f.adminName
        )

        if (pendingIndex !== -1) {

            const todayStr = new Date().toLocaleDateString(
                "en-CA",
                {
                    timeZone: "Asia/Dubai"
                }
            )

            const scheduledStr = new Date(
                lead.followUps[pendingIndex].followUpDate
            ).toLocaleDateString(
                "en-CA",
                {
                    timeZone: "Asia/Dubai"
                }
            )

            const todayDate = new Date(todayStr)
            const scheduledDate = new Date(scheduledStr)

            const diffTime =
                todayDate.getTime() -
                scheduledDate.getTime()

            const gap = Math.floor(
                diffTime /
                (1000 * 60 * 60 * 24)
            )

            lead.followUps[pendingIndex].followUpGap =
                gap > 0 ? gap : 0

            lead.followUps[pendingIndex].followUpTakenVia =
                followUpTakenVia

            lead.followUps[pendingIndex].adminName =
                adminName

            lead.followUps[pendingIndex].followUpNotes =
                followUpNotes

            lead.followUps[pendingIndex].clientResponse = clientResponse;

            // lead.followUps[pendingIndex].completedDate =
            //     new Date()

            // Create next followup only if date selected
            if (followUpDate) {
                lead.followUps.push({
                    followUpDate: new Date(followUpDate)
                })
            }
        } else {

            // No pending followup exists
            // Create a completely new followup record

            lead.followUps.push({
                followUpDate: followUpDate
                    ? new Date(followUpDate)
                    : new Date(),
                followUpTakenVia,
                adminName,
                followUpNotes,
                clientResponse,
                // completedDate: new Date(),
                followUpGap: 0
            })
        }

        await lead.save()

        return res.status(200).json({
            success: true,
            message: "Follow-up added successfully",
            followUps: lead.followUps
        })

    } catch (error) {

        console.error(
            "Error adding follow-up:",
            error
        )

        return res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Update clent response
const updateFollowUpClientResponse = async (req, res) => {
    try {
        const { refNo, followUpId } = req.params
        const { clientResponse } = req.body

        const lead = await Data.findOne({ refNo })

        if (!lead) {
            return res.status(404).json({
                success: false,
                message: 'Lead not found'
            })
        }

        const followUp = lead.followUps.id(followUpId)

        if (!followUp) {
            return res.status(404).json({
                success: false,
                message: 'Follow-up not found'
            })
        }

        followUp.clientResponse = clientResponse

        await lead.save()

        return res.status(200).json({
            success: true,
            message: 'Client response updated successfully',
            followUps: lead.followUps
        })

    } catch (error) {
        console.error("Error updating client response:", error)
        return res.status(500).json({ message: "Internal server error" })
    }
}

// Get all lead dashboard data
const getLeadDashboardData = async (req, res) => {
    try {
        const { year, month } = req.query

        const now = new Date()

        const filterYear = parseInt(year) || now.getFullYear()
        const filterMonth = parseInt(month) || (now.getMonth() + 1)

        const startDate = new Date(filterYear, filterMonth - 1, 1)
        const endDate = new Date(filterYear, filterMonth, 1)

        const prevStartDate = new Date(filterYear, filterMonth - 2, 1)
        const prevEndDate = new Date(filterYear, filterMonth - 1, 1)

        const result = await Data.aggregate([
            {
                $facet: {
                    currentMonth: [
                        {
                            $match: {
                                leadAddedDate: {
                                    $gte: startDate,
                                    $lt: endDate
                                }
                            }
                        },
                        {
                            $group: {
                                _id: null,

                                totalLeads: {
                                    $sum: 1
                                },

                                wonCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "Won"
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                lostCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "Lost"
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },


                            }
                        }
                    ],
                }
            }
        ])

        const salesPersonPerformance = await Data.aggregate([
            {
                $match: {
                    invoiceDate: {
                        $gte: startDate,
                        $lt: endDate
                    }
                }
            },
            {
                $group: {
                    _id: "$assignToSalesPerson",

                    totalLeads: {
                        $sum: 1
                    },

                    wonDeals: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                1,
                                0
                            ]
                        }
                    },

                    // wonDealValue: {
                    //     $sum: {
                    //         $cond: [
                    //             { $eq: ["$dealStatus", "Won"] },
                    //             "$dealAmount",
                    //             0
                    //         ]
                    //     }
                    // }
                }
            },
            {
                $project: {
                    _id: 0,
                    salesPerson: "$_id",
                    // totalLeads: 1,
                    wonDeals: 1,
                    // wonDealValue: 1
                }
            },
            {
                $sort: {
                    wonDeals: -1
                }
            }
        ]);

        const current =
            result[0].currentMonth[0] || {
                totalLeads: 0,
                wonCount: 0,
                lostCount: 0,

            };

        res.status(200).json({
            success: true,
            month: filterMonth,
            year: filterYear,
            currentMonth: current,
            salesPersonPerformance
        })
    } catch (error) {
        console.error(
            "Dashboard Error",
            error.message
        )

        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

// Get followup priority list
const getFollowUpPriorityList = async (req, res) => {
    try {
        const { search = "", assignToSalesPerson, dealStatus } = req.query

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const baseMatch = {
            dealStatus: {
                $nin: ["Won", "Lost"]
            }
        }

        const salesPersonArray = assignToSalesPerson
            ? assignToSalesPerson.split(',')
            : []

        if (salesPersonArray.length > 0) {
            baseMatch.assignToSalesPerson = {
                $in: salesPersonArray
            }
        }

        const dealStatusArray = dealStatus
            ? dealStatus.split(',')
            : []

        if (dealStatus.length > 0) {
            baseMatch.dealStatus = {
                $in: dealStatusArray
            }
        }

        if (search) {
            if (!isNaN(Number(search))) {
                baseMatch.$or = [
                    {
                        phoneNumber: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$invoiceNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$quoteNumber" },
                                regex: search,
                                options: "i"
                            }
                        }
                    },
                    {
                        products: {
                            $elemMatch: {
                                productId: Number(search)
                            }
                        }
                    }
                ]
            } else {
                baseMatch.$or = [
                    {
                        name: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        companyName: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        emailId: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        source: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        assignToSalesPerson: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        division: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        dealStatus: {
                            $regex: search,
                            $options: "i"
                        }
                    },
                    {
                        "products.productName": {
                            $regex: search,
                            $options: "i"
                        }
                    }
                ]
            }
        }

        const leads = await Data.find(baseMatch)
            .sort({ createdAt: 1 })
            .lean()

        const overDue = []
        const today = []
        const upComing = []

        leads.forEach((lead) => {
            if (!lead.followUps?.length) return

            const followUps = lead.followUps

            const currentFollowUp = [...followUps]
                .reverse()
                .find(
                    (f) =>
                        f.followUpDate &&
                        (f.followUpTakenVia ||
                            f.followUpNotes ||
                            f.adminName)
                )

            const nextFollowUp = [...followUps]
                .reverse()
                .find(
                    (f) =>
                        f.followUpDate &&
                        !f.followUpTakenVia &&
                        !f.followUpNotes &&
                        !f.adminName
                )

            if (!nextFollowUp) return

            const completedFollowUps = followUps.filter(
                (f) =>
                    f.followUpDate &&
                    (f.followUpTakenVia ||
                        f.followUpNotes ||
                        f.adminName)
            )

            const followUpstakenCount =
                completedFollowUps.length

            const formattedLead = {
                _id: lead._id,
                refNo: lead.refNo,
                uid: lead.uid,
                name: lead.name,
                companyName: lead.companyName,
                phoneNumber: lead.phoneNumber,
                emailId: lead.emailId,
                source: lead.source,
                division: lead.division,
                assignToSalesPerson:
                    lead.assignToSalesPerson,
                dealStatus: lead.dealStatus,
                followUpstakenCount,

                // Current Follow-up
                currentFollowUpDate:
                    currentFollowUp?.followUpDate,
                followUpTakenVia:
                    currentFollowUp?.followUpTakenVia,
                adminName: currentFollowUp?.adminName,
                followUpNotes:
                    currentFollowUp?.followUpNotes,

                // Next Follow-up
                nextFollowUpDate:
                    nextFollowUp.followUpDate
            }

            const todayStr = new Date().toLocaleDateString(
                "en-CA",
                {
                    timeZone: "Asia/Dubai"
                }
            )

            const followUpStr = new Date(
                nextFollowUp.followUpDate
            ).toLocaleDateString("en-CA", {
                timeZone: "Asia/Dubai"
            })

            if (followUpStr < todayStr) {
                overDue.push(formattedLead)
            } else if (followUpStr === todayStr) {
                today.push(formattedLead)
            } else {
                upComing.push(formattedLead)
            }
        })

        res.status(200).json({
            success: true,
            counts: {
                overDue: overDue.length,
                today: today.length,
                upComing: upComing.length
            },
            data: {
                overDue,
                today,
                upComing
            }
        })
    } catch (error) {
        console.error(
            "Error getting follow-up priority list:",
            error.message
        )

        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}

module.exports = { getAllCustomerIds, addNewLeadData, updateLeadData, updateFirstFollowupdate, getAllLeadsData, getIndividualLeadData, addFollowUp, getLeadDashboardData, getFollowUpPriorityList, getGlobalSearchAllLeadsData, updateFollowUpClientResponse }
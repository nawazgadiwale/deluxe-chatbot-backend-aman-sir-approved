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

// Add new lead data
const addNewLeadData = async (req, res) => {
    try {
        const uid = await getNextInvoiceNumber()

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
            products
            // followUpDate
        } = req.body

        if (
            !createdBy ||
            !uid ||
            !name ||
            !phoneNumber ||
            !source ||
            !assignToSalesPerson ||
            !dealStatus ||
            !leadAddedDate
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
            products

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

// Update new lead data
const updateLeadData = async (req, res) => {
    try {
        const { uid } = req.params

        const { name, companyName, phoneNumber, emailId, dealAmount, source, division, assignToSalesPerson, dealStatus, quoteNumber, initialRemartks, leadAddedDate, invoiceNumber, products, adminName } = req.body

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
            endDate
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

        if (startDate && endDate) {
            baseMatch.leadAddedDate = {
                $gte: new Date(startDate),
                $lte: new Date(
                    new Date(endDate).setHours(23, 59, 59, 999)
                )
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
            followUpNotes
        } = req.body

        if (!uid) {
            return res.status(400).json({
                message: "UID is required!"
            })
        }

        const lead = await Data.findOne({ uid })

        if (!lead) {
            return res.status(404).json({
                message: "Lead not found"
            })
        }

        const lastIndex = lead.followUps.length - 1

        // CURRENT FOLLOWUP -> TODAY
        const today = new Date()

        // scheduled followup date
        const scheduledDate = new Date(
            lead.followUps[lastIndex].followUpDate
        )

        // remove time part
        today.setHours(0, 0, 0, 0)
        scheduledDate.setHours(0, 0, 0, 0)

        // difference in days
        const diffTime = today - scheduledDate

        const gap = Math.floor(
            diffTime / (1000 * 60 * 60 * 24)
        )

        // if overdue store gap else 0
        lead.followUps[lastIndex].followUpGap =
            gap > 0 ? gap : 0

        // current followup activity
        lead.followUps[lastIndex].followUpTakenVia =
            followUpTakenVia

        lead.followUps[lastIndex].adminName =
            adminName

        lead.followUps[lastIndex].followUpNotes =
            followUpNotes

        // actual completed date
        lead.followUps[lastIndex].followUpDate =
            today

        // NEXT FOLLOWUP DATE
        if (followUpDate) {
            lead.followUps.push({
                followUpDate: new Date(followUpDate)
            })
        }

        await lead.save()

        res.status(200).json({
            success: true,
            message: "Follow-up added successfully",
            followUps: lead.followUps
        })

    } catch (error) {
        console.error(
            "Error adding follow-up:",
            error.message
        )

        res.status(500).json({
            message: "Internal Server Error"
        })
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

                                newCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "New"
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                contactedCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "Contacted"
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
                                },

                                quotedCount: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "Quoted"
                                                ]
                                            },
                                            1,
                                            0
                                        ]
                                    }
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

                                wonDealValue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$dealStatus",
                                                    "Won"
                                                ]
                                            },
                                            "$dealAmount",
                                            0
                                        ]
                                    }
                                },
                                quotedDealValue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $in: [
                                                    "$dealStatus",
                                                    ["Won", "Quoted", "Lost"]
                                                ]
                                            },
                                            "$dealAmount",
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                }
            }
        ])

        const current =
            result[0].currentMonth[0] || {
                totalLeads: 0,
                newCount: 0,
                contactedCount: 0,
                quotedCount: 0,
                wonCount: 0,
                lostCount: 0,
                wonDealValue: 0,
                quotedDealValue: 0
            };

        res.status(200).json({
            success: true,
            month: filterMonth,
            year: filterYear,
            currentMonth: current,
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
        const { search = "" } = req.query

        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const baseMatch = {
            dealStatus: {
                $nin: ["Won", "Lost"]
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
            .sort({ createdAt: -1 })
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

            const followUpDate = new Date(
                nextFollowUp.followUpDate
            )

            followUpDate.setHours(0, 0, 0, 0)

            if (followUpDate < startOfToday) {
                overDue.push(formattedLead)
            } else if (followUpDate.getTime() === startOfToday.getTime()) {
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

module.exports = { addNewLeadData, updateLeadData, updateFirstFollowupdate, getAllLeadsData, getIndividualLeadData, addFollowUp, getLeadDashboardData, getFollowUpPriorityList, getGlobalSearchAllLeadsData }
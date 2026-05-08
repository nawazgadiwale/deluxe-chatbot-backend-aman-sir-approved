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
            followUpDate
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

        const finalFollowUpDate = followUpDate
            ? new Date(followUpDate)
            : new Date(leadDate.getTime() + 3 * 24 * 60 * 60 * 1000)

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

            followUps: [
                {
                    followUpDate: finalFollowUpDate
                }
            ]
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

        const { name, companyName, phoneNumber, emailid, dealAmount, source, division, assignToSalesPerson, dealStatus, quoteNumber, initialRemartks, leadAddedDate, invoiceNumber, followUpDate, followUpTakenVia, adminName, followUpNotes } = req.body

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

        if (emailid !== undefined) {
            lead.emailId = emailid
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

        if (followUpTakenVia || adminName || followUpNotes) {
            if (!lead.followUps.length) {
                return res.status(400).json({
                    message: "No follow-up exists"
                })
            }

            const lastIndex = lead.followUps.length - 1

            if (followUpTakenVia) {
                lead.followUps[lastIndex].followUpTakenVia = followUpTakenVia
            }

            if (adminName) {
                lead.followUps[lastIndex].adminName = adminName
            }

            if (followUpNotes) {
                lead.followUps[lastIndex].followUpNotes = followUpNotes
            }

            let nextFollowUpDate

            if (followUpDate) {
                nextFollowUpDate = new Date(followUpDate)
            } else {
                nextFollowUpDate = new Date(
                    lead.followUps[lastIndex].followUpDate
                )

                nextFollowUpDate.setDate(
                    nextFollowUpDate.getDate() + 3
                )
            }

            lead.followUps.push({
                followUpDate: nextFollowUpDate
            })
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
            month
        } = req.query

        const now = new Date()

        const filterYear = parseInt(year) || now.getFullYear()
        const filterMonth = parseInt(month) || (now.getMonth() + 1)

        const startDate = new Date(filterYear, filterMonth - 1, 1)
        const endDate = new Date(filterYear, filterMonth, 1)

        const baseMatch = {
            leadAddedDate: {
                $gte: startDate,
                $lt: endDate
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
                ]
            } else {
                baseMatch.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { companyName: { $regex: search, $options: "i" } },
                    { emailId: { $regex: search, $options: "i" } },
                ]
            }
        }

        if (source) baseMatch.source = source
        if (dealStatus) baseMatch.dealStatus = dealStatus
        if (assignToSalesPerson) baseMatch.assignToSalesPerson = assignToSalesPerson
        if (division) baseMatch.division = division

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
        if (adminName) {
            pipeline.push({
                $match: {
                    createdBy: adminName
                }
            })
        }

        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: (page - 1) * parseInt(limit) },
            { $limit: parseInt(limit) }
        )

        const leads = await Data.aggregate(pipeline)

        const countPipeline = [
            { $match: baseMatch },
            { $count: "total" }
        ]

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

        const { followUpDate, followUpTakenVia, adminName, followUpNotes } = req.body

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

        // Update current follow-up with activity details
        lead.followUps[lastIndex].followUpTakenVia = followUpTakenVia
        lead.followUps[lastIndex].adminName = adminName
        lead.followUps[lastIndex].followUpNotes = followUpNotes

        let nextFollowUpDate

        if (followUpDate) {
            nextFollowUpDate = new Date(followUpDate)
        } else {
            if (lead.followUps.length > 0) {
                const lastFollowUp =
                    lead.followUps[lead.followUps.length - 1].followUpDate

                nextFollowUpDate = new Date(lastFollowUp)
            } else {
                nextFollowUpDate = new Date()
            }

            nextFollowUpDate.setDate(
                nextFollowUpDate.getDate() + 3
            )
        }

        lead.followUps.push({
            followUpDate: nextFollowUpDate
        })

        await lead.save()

        res.status(200).json({
            success: true,
            message: "Follow-up updated and next follow-up created",
            followUps: lead.followUps
        })

        lead.followUps.push(newFollowUp)

        await lead.save()

        res.status(200).json({
            success: true,
            message: "Follow-up added successfully",
            followUps: lead.followUps
        })

    } catch (error) {
        console.error("Error adding follow-up:",
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
        const startOfToday = new Date()
        startOfToday.setHours(0, 0, 0, 0)

        const endOfToday = new Date()
        endOfToday.setHours(23, 59, 59, 999)

        const leads = await Data.find({
            dealStatus: {
                $nin: ["Won"]
            }
        }).sort({ createdAt: -1 }).lean()

        const overDue = []
        const today = []
        const upComing = []


        leads.forEach((lead) => {
            if (!lead.followUps || lead.followUps.length === 0) return

            const followUps = lead.followUps || []

            if (followUps.length === 0) return

            const currentFollowUp = [...followUps]
                .reverse()
                .find(f =>
                    f.followUpDate &&
                    (f.followUpTakenVia || f.followUpNotes || f.adminName)
                )

            const nextFollowUp = [...followUps]
                .reverse()
                .find(f =>
                    f.followUpDate &&
                    !f.followUpTakenVia &&
                    !f.followUpNotes &&
                    !f.adminName
                )

            const completedFollowUps = followUps.filter(f =>
                f.followUpDate && (f.followUpTakenVia || f.followUpNotes || f.adminName)
            )

           const followUpstakenCount = completedFollowUps.length

            // If no next follow-up, skip
            if (!nextFollowUp) return

            const followUpDate = new Date(nextFollowUp.followUpDate)


            const formattedLead = {
                _id: lead._id,
                uid: lead.uid,
                name: lead.name,
                companyName: lead.companyName,
                phoneNumber: lead.phoneNumber,
                emailId: lead.emailId,
                source: lead.source,
                division: lead.division,
                assignToSalesPerson: lead.assignToSalesPerson,
                dealStatus: lead.dealStatus,
                followUpstakenCount,
                // ✅ current (completed)
                currentFollowUpDate: currentFollowUp?.followUpDate,
                followUpTakenVia: currentFollowUp?.followUpTakenVia,
                adminName: currentFollowUp?.adminName,
                followUpNotes: currentFollowUp?.followUpNotes,

                // ✅ next (pending)
                nextFollowUpDate: nextFollowUp.followUpDate
            }

            // OVERDUE
            if (followUpDate < startOfToday) {
                overDue.push(formattedLead)
            }

            // TODAY
            else if (followUpDate >= startOfToday && followUpDate <= endOfToday) {
                today.push(formattedLead)
            }

            else {
                upComing.push(formattedLead)
            }
        })

        res.status(200).json({
            success: true,
            counts: {
                overDue: overDue.length,
                today: today.length,
                upComing: upComing.length,
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

module.exports = { addNewLeadData, updateLeadData, getAllLeadsData, getIndividualLeadData, addFollowUp, getLeadDashboardData, getFollowUpPriorityList }
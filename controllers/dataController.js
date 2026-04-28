const Data = require('../models/Data')

const addNewLeadData = async (req, res) => {
    try {
        const {
            createdBy,
            uid,
            name,
            companyName,
            phoneNumber,
            emailId,
            source,
            division,
            assignToSalesPerson,
            dealStatus,
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
                message: "The Invoice is Already Created!"
            })
        }

        const leadDate = new Date(leadAddedDate)

        let finalFollowUpDate

        if (followUpDate) {
            finalFollowUpDate = new Date(followUpDate)
        } else {
            finalFollowUpDate = new Date(leadDate)
            finalFollowUpDate.setDate(finalFollowUpDate.getDate() + 3)
        }

        const newLead = new Data({
            createdBy,
            uid,
            name,
            companyName,
            phoneNumber,
            emailId,
            source,
            division,
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

const updateLeadData = async (req, res) => {
    try {
        const { uid } = req.params

        const { name, companyName, phoneNumber, emailid, source, division, assignToSalesPerson, dealStatus, quoteNumber, initialRemartks, leadAddedDate, invoiceNumber, followUpDate, followUpTakenVia, adminName, followUpNotes } = req.body

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

const getAllLeadsData = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", source, dealStatus, assignToSalesPerson, division, userRole, userName, year, month } = req.query

        const now = new Date()

        const filterYear = parseInt(year) || now.getFullYear()
        const filterMonth = parseInt(month) || (now.getMonth() + 1)

        const startDate = new Date(filterYear, filterMonth - 1, 1)
        const endDate = new Date(filterYear, filterMonth, 1)

        const pipeline = []

        pipeline.push({
            $match: {
                leadAddedDate: {
                    $gte: startDate,
                    $lt: endDate
                }
            }
        })

        if (search) {
            if (!isNaN(search)) {
                pipeline.push({
                    $match: {
                        $or: [
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
                        ]
                    }
                })
            }
            else {
                pipeline.push({
                    $match: {
                        $or: [
                            { name: { $regex: search, $options: "i" } },
                            { companyName: { $regex: search, $options: "i" } },
                            { emailId: { $regex: search, $options: "i" } },
                            { phoneNumber: { $regex: search, $options: "i" } },
                        ]
                    }
                })
            }
        }

        if (source) pipeline.push({ $match: { source } })
        if (dealStatus) pipeline.push({ $match: { dealStatus } })
        if (assignToSalesPerson) pipeline.push({ $match: { assignToSalesPerson } })
        if (division) pipeline.push({ $match: { division } })

        pipeline.push({ $sort: { createdAt: -1 } })
        pipeline.push({ $skip: (page - 1) * parseInt(limit) })
        pipeline.push({ $limit: parseInt(limit) })

        const leads = await Data.aggregate(pipeline)
        const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage))
        countPipeline.push({ $count: "total" })

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
                                }
                            }
                        }
                    ],

                    previousMonth: [
                        {
                            $match: {
                                leadAddedDate: {
                                    $gte: prevStartDate,
                                    $lt: prevEndDate
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
                                }
                            }
                        }
                    ]
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
                wonDealValue: 0
            };

        const previous =
            result[0].previousMonth[0] || {
                totalLeads: 0,
                wonCount: 0,
                wonDealValue: 0
            };


        res.status(200).json({
            success: true,
            month: filterMonth,
            year: filterYear,
            currentMonth: current,
            previousMonth: previous
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

module.exports = { addNewLeadData, updateLeadData, getAllLeadsData, getIndividualLeadData, addFollowUp, getLeadDashboardData }
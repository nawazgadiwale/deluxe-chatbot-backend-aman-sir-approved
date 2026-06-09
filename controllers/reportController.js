const Data = require("../models/Data")

const getReportsDashboardData = async (req, res) => {
    try {
        const {
            year = new Date().getFullYear(),
            month = new Date().getMonth() + 1
        } = req.query

        // Total leads count
        const totalLeads = await Data.countDocuments()

        // Distribution of leads by deal status and total amount by deal status
        const dealStatusCounts = await Data.aggregate([
            {
                $group: {
                    _id: "$dealStatus",
                    count: { $sum: 1 },
                    amount: { $sum: "$dealAmount" }
                }
            }
        ])

        // Initialize distribution objects with all possible statuses to ensure consistent keys
        const statusDistribution = {
            Open: 0,
            Contacted: 0,
            Quoted: 0,
            "On-Going": 0,
            "No-reply": 0,
            Won: 0,
            Lost: 0
        }

        // Initialize amount distribution with all possible statuses to ensure consistent keys
        const statusAmountDistribution = {
            Open: 0,
            Contacted: 0,
            Quoted: 0,
            "On-Going": 0,
            "No-reply": 0,
            Won: 0,
            Lost: 0
        }

        // Fill in the actual counts and amounts from the aggregation results
        dealStatusCounts.forEach((item) => {
            statusDistribution[item._id] = item.count
            statusAmountDistribution[item._id] = item.amount
        })

        // Total amount for "Won" deals
        const totalWonAmount = await Data.aggregate([
            {
                $match: {
                    dealStatus: "Won"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$dealAmount" }
                }
            }
        ])

        // Total amount for "Quoted", "Won", "Lost", "On-Going", and "No-reply" deals
        const totalQuotedAmount = await Data.aggregate([
            {
                $match: {
                    dealStatus: {
                        $in: [
                            "Won",
                            "Quoted",
                            "Lost",
                            "On-Going",
                            "No-reply"
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$dealAmount" }
                }
            }
        ])

        // Conversation rate calculation
        const conversationRate =
            totalLeads > 0
                ? (
                    (statusDistribution.Won / totalLeads) * 100
                ).toFixed(2)
                : 0

        // Average follow-ups per lead calculation
        const avgFollowupData = await Data.aggregate([
            {
                $project: {
                    followUpCount: {
                        $size: {
                            $ifNull: ["$followUps", []]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgFollowUps: {
                        $avg: "$followUpCount"
                    }
                }
            }
        ])

        // Lead source distribution with grouping for similar sources (e.g., Google Ads)
        const leadSourceData = await Data.aggregate([
            {
                $project: {
                    sourceGroup: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $regexMatch: {
                                            input: "$source",
                                            regex: /Google Ads/i
                                        }
                                    },
                                    then: "Google Ads"
                                }
                            ],
                            default: "$source"
                        }
                    },
                    dealAmount: {
                        $ifNull: ["$dealAmount", 0]
                    },
                    dealStatus: 1
                }
            },
            {
                $group: {
                    _id: "$sourceGroup",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$dealAmount" },
                    wonAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                "$dealAmount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    source: "$_id",
                    count: 1,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    wonAmount: { $round: ["$wonAmount", 2] }
                }
            },
            {
                $sort: {
                    count: -1
                }
            }
        ])

        // Division performance data
        const divisionPerformance = await Data.aggregate([
            {

                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), Number(month) - 1, 1),
                        $lt: new Date(Number(year), Number(month), 1)
                    },
                    division: {
                        $nin: [null, "", "N/A"]
                    }
                },



            },
            {
                $group: {
                    _id: "$division",
                    leads: { $sum: 1 },

                    totalAmount: {
                        $sum: {
                            $ifNull: ["$dealAmount", 0]
                        }
                    },

                    wonAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                { $ifNull: ["$dealAmount", 0] },
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: {
                    wonAmount: -1
                }
            }
        ])

        const totalWonRevenue = divisionPerformance.reduce(
            (sum, item) => sum + item.wonAmount,
            0
        )

        const divisionData = divisionPerformance.map(item => ({
            division: item._id,
            leads: item.leads,
            wonAmount: item.wonAmount,
            amount: item.totalAmount,
            percentage:
                totalWonRevenue > 0
                    ? Number(((item.wonAmount / totalWonRevenue) * 100).toFixed(2)) : 0
        }))

        // Top products by revenue
        const topProducts = await Data.aggregate([

            {
                $unwind: "$products"
            },
            {
                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), Number(month) - 1, 1),
                        $lt: new Date(Number(year), Number(month), 1)
                    },
                    "products.productName": {
                        $ne: "N/A"
                    }
                }
            },
            {
                $group: {
                    _id: "$products.productName",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$dealAmount" },
                    wonAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                "$dealAmount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    productName: "$_id",
                    count: 1,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    wonAmount: { $round: ["$wonAmount", 2] }
                }
            },
            {
                $sort: {
                    wonAmount: -1
                }
            },
            {
                $limit: 10
            }
        ])

        // Monthly leads graph data
        // Monthly leads graph data (all 12 months)
        const monthlyLeadCounts = await Data.aggregate([
            {
                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), 0, 1),
                        $lt: new Date(Number(year) + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$leadAddedDate" } },
                    totalDeals: { $sum: 1 }
                }
            }
        ]);

        const monthlyQuoteAmounts = await Data.aggregate([
            {
                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), 0, 1),
                        $lt: new Date(Number(year) + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: { month: { $month: "$leadAddedDate" } },
                    totalAmount: {
                        $sum: {
                            $ifNull: ["$dealAmount", 0]
                        }
                    }
                }
            }
        ]);

        const monthlyRevenue = await Data.aggregate([
            {

                $match: {
                    invoiceDate: {
                        $gte: new Date(Number(year), 0, 1),
                        $lt: new Date(Number(year) + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$invoiceDate" }
                    },
                    totalWonAmount: {
                        $sum: {
                            $ifNull: ["$dealAmount", 0]
                        }
                    },
                    totalInvoices: { $sum: 1 }
                }
            }
        ]);

        const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec"
        ]

        const monthlyLeads = monthNames.map((monthName, index) => {
            const month = index + 1;

            const leads = monthlyLeadCounts.find(
                item => item._id.month === month
            );

            const quotes = monthlyQuoteAmounts.find(
                item => item._id.month === month
            );

            const revenue = monthlyRevenue.find(
                item => item._id.month === month
            );

            return {
                month: monthName,
                totalDeals: leads?.totalDeals || 0,
                totalAmount: quotes?.totalAmount || 0,
                totalWonAmount: revenue?.totalWonAmount || 0
            };
        });

        // Monthly deal status distribution graph data
        const monthlyWiseDealStatus = await Data.aggregate([
            {
                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), Number(month) - 1, 1),
                        $lt: new Date(Number(year), Number(month), 1)
                    }
                }
            },
            {
                $group: {
                    _id: "$dealStatus",
                    count: { $sum: 1 },
                    amount: { $sum: "$dealAmount" }
                }
            },
            {
                $sort: {
                    count: -1
                }
            }
        ])

        // All sales persons performance graph data
        const salesPersonPerformance = await Data.aggregate([
            {
                $group: {
                    _id: "$assignToSalesPerson",
                    totalLeads: { $sum: 1 },
                    totalAmount: { $sum: "$dealAmount" },
                    wonDeals: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                1,
                                0
                            ]
                        }
                    },
                    wonAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                "$dealAmount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    salesPerson: "$_id",
                    totalLeads: 1,
                    wonDeals: 1,
                    totalAmount: { $round: ["$totalAmount", 2] },
                    wonAmount: { $round: ["$wonAmount", 2] }
                }
            },
            {
                $sort: {
                    wonDeals: -1
                }
            }
        ])

        // Top 10 deals list
        const topDeals = await Data.find({
            dealStatus: "Won",
            dealAmount: { $gt: 0 },
            leadAddedDate: {
                $gte: new Date(Number(year), Number(month) - 1, 1),
                $lt: new Date(Number(year), Number(month), 1)
            }
        })
            .populate("createdBy", "name")
            .sort({
                dealAmount: -1
            })
            .limit(10)

        // Recent 10 deals list
        const recentDeals = await Data.find()
            .sort({ createdAt: -1 })
            .limit(10)

        // Top 5 Sales persons
        const topSalesPersons = await Data.aggregate([
            {
                $match: {
                    leadAddedDate: {
                        $gte: new Date(Number(year), Number(month) - 1, 1),
                        $lt: new Date(Number(year), Number(month), 1)
                    }
                }
            },
            {
                $group: {
                    _id: "$assignToSalesPerson",
                    totalLeads: { $sum: 1 },
                    totalAmount: { $sum: "$dealAmount" },
                    wonDeals: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                1,
                                0
                            ]
                        }
                    },
                    wonAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$dealStatus", "Won"] },
                                "$dealAmount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: {
                    wonDeals: -1,
                }
            },
            {
                $limit: 10
            }
        ])

        // Return the compiled report data
        return res.status(200).json({
            success: true,
            overview: {
                totalLeads,
                distribution: statusDistribution,
                amountDistribution: statusAmountDistribution,
                totalWonAmount: totalWonAmount[0]?.total || 0,
                totalQuotedAmount: totalQuotedAmount[0]?.total || 0,
                conversationRate,
                avgFollowUps: avgFollowupData[0]?.avgFollowUps || 0
            },
            charts: {
                leadSourceData,
                divisionPerformance: divisionData,
                topProducts,
                monthlyLeads,
                monthlyWiseDealStatus,
                salesPersonPerformance
            },
            rankings: {
                topDeals,
                recentDeals,
                topSalesPersons
            }
        })
    } catch (error) {
        console.error("Unable to fetch reports data", error)

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard reports",
            error: error.message
        })
    }
}

module.exports = { getReportsDashboardData }
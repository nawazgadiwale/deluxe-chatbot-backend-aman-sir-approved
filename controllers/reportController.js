const Data = require("../models/Data")

const getReportsDashboardData = async (req, res) => {
    try {
        const totalLeads = await Data.countDocuments()
        const dealStatusCounts = await Data.aggregate([
            {
                $group: {
                    _id: "$dealStatus",
                    count: { $sum: 1 },
                    amount: { $sum: "$dealAmount" }
                }
            }
        ])

        const statusDistribution = {
            Open: 0,
            Contacted: 0,
            Quoted: 0,
            "On-Going": 0,
            "No-Reply": 0,
            Won: 0,
            Lost: 0
        }

        const statusAmountDistribution = {
            Open: 0,
            Contacted: 0,
            Quoted: 0,
            "On-Going": 0,
            "No-Reply": 0,
            Won: 0,
            Lost: 0
        }

        dealStatusCounts.forEach((item) => {
            statusDistribution[item._id] = item.count
            statusAmountDistribution[item._id] = item.amount
        })

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

        const totalQuotedAmount = await Data.aggregate([
            {
                $match: {
                    dealStatus: {
                        $in: [
                            "Won",
                            "Quoted",
                            "Lost",
                            "On-Going",
                            "No-Reply"
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

        const conversationRate =
            totalLeads > 0
                ? (
                    (statusDistribution.Won / totalLeads) * 100
                ).toFixed(2)
                : 0

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
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

const getDetailedAnalyticsData = async (req, res) => {
    try {
        // Parse Filters
        const {
            dateField = "leadAddedDate",
            startDate,
            endDate,
            year = new Date().getFullYear(),
            month,
            dealStatus,
            division,
            source,
            assignToSalesPerson,
            minAmount,
            maxAmount,
            productName,
            sections,
        } = req.query

        const ALLOWED_DATE_FIELDS = ["leadAddedDate", "invoiceDate", "quoteDate"]
        const resolvedDateField = ALLOWED_DATE_FIELDS.includes(dateField) ? dateField : "leadAddedDate"

        let dateStart, dateEnd
        if (startDate || endDate) {
            dateStart = startDate ? new Date(startDate) : new Date("2026-04-01")
            dateEnd = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date()
        } else if (month) {
            dateStart = new Date(Number(year), Number(month) - 1, 1)
            dateEnd = new Date(Number(year), Number(month), 1)
        } else {
            dateStart = new Date(Number(year), 0, 1)
            dateEnd = new Date(Number(year) + 1, 0, 1)
        }

        // Helper - parse comma-separated query param into array
        const parseList = (param) =>
            param ? param.split(",").map((s) => s.trim()).filter(Boolean) : null

        const dealStatusFilter = parseList(dealStatus)
        const divisionFilter = parseList(division)
        const sourceFilter = parseList(source)
        const salesPersonFilter = parseList(assignToSalesPerson)
        const productNameFilter = parseList(productName)
        const sectionsFilter = sections ? new Set(parseList(sections)) : null

        // Decide which section to compute
        const want = (name) => !sectionsFilter || sectionsFilter.has(name)

        // Base Match
        // Primary match used for most aggregations
        const buildBaseMatch = (extraFields = {}) => {
            const match = {
                [resolvedDateField]: { $gte: dateStart, $lt: dateEnd },
                ...extraFields
            }

            if (dealStatusFilter?.length) match.dealStatus = { $in: dealStatusFilter }
            if (divisionFilter?.length) match.division = { $in: divisionFilter }
            if (sourceFilter?.length) match.source = { $in: sourceFilter }
            if (salesPersonFilter?.length) match.assignToSalesPerson = { $in: salesPersonFilter }
            if (minAmount !== undefined || maxAmount !== undefined) {
                match.dealAmount = {}
                if (minAmount !== undefined) match.dealAmount.$gte = Number(minAmount)
                if (maxAmount !== undefined) match.dealAmount.$lte = Number(maxAmount)
            }

            return match
        }

        const baseMatch = buildBaseMatch()

        // Overview
        let overview = null

        if (want("overview") || want("dealStatus")) {
            const [totalLeadResult, dealStatusAgg, wonAgg, quotedAgg, avgFollowupAgg] =
                await Promise.all([
                    // Total Leads in filtered range
                    Data.countDocuments(baseMatch),

                    // Pre-status counts + amounts
                    Data.aggregate([
                        { $match: baseMatch },
                        {
                            $group: {
                                _id: "$dealStatus",
                                count: { $sum: 1 },
                                amount: { $sum: { $ifNull: ["$dealAmount", 0] } },
                            }
                        }
                    ]),

                    // Won total amount
                    Data.aggregate([
                        { $match: { ...baseMatch, dealStatus: "Won" } },
                        { $group: { _id: null, total: { $sum: { $ifNull: ["$dealAmount", 0] } } } }
                    ]),


                    // Quoted-pipeline total amount (Qon + Quoted + Contacted + Lost + On-Going + No-Reply)
                    Data.aggregate([
                        {
                            $match: {
                                ...baseMatch,
                                dealStatus: { $in: ["Won", "Contacted", "Quoted", "Lost", "On-Going", "No-Reply"] }
                            }
                        },
                        { $group: { _id: null, total: { $sum: { $ifNull: ["$dealAmount", 0] } } } }
                    ]),

                    // Avg followups
                    Data.aggregate([
                        { $match: baseMatch },
                        {
                            $project: {
                                followUpCount: { $size: { $ifNull: ["$followUps", []] } }
                            }
                        },
                        {
                            $group: {
                                _id: null, avgFollowUps: {
                                    $avg: "$followUpCount"
                                }
                            }
                        }
                    ]),

                ])

            const ALL_STATUSES = ["Open", "Contacted", "Quoted", "On-Going", "No-Reply", "Won", "Lost"]
            const statusDistribution = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]))
            const statusAmountDistribution = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0]))

            dealStatusAgg.forEach(({ _id, count, amount }) => {
                if (_id) {
                    statusDistribution[_id] = count
                    statusAmountDistribution[_id] = amount
                }
            })

            const totalLeads = totalLeadResult
            const totalWonAmount = wonAgg[0]?.total || 0
            const totalQuotedAmount = quotedAgg[0]?.total || 0
            const conversionRate = totalLeads > 0
                ? Number(((statusDistribution.Won / totalLeads)
                    * 100).toFixed(2)
                ) : 0

            overview = {
                totalLeads,
                distribution: statusDistribution,
                amountDistribution: statusAmountDistribution,
                totalWonAmount,
                totalQuotedAmount,
                conversionRate,
                avgFollowUps: avgFollowupAgg[0]?.avgFollowUps
                    ? Number(avgFollowupAgg[0].avgFollowUps.toFixed(2))
                    : 0,
            }
        }

        // Lead Source
        let leadSourceData = null

        if (want("leadSource")) {
            leadSourceData = await Data.aggregate([
                { $match: baseMatch },
                {
                    $project: {
                        sourceGroup: {
                            $switch: {
                                branches: [
                                    {
                                        case: { $regexMatch: { input: "$source", regex: /Google Ads/i } },
                                        then: "Google Ads"
                                    }
                                ],
                                default: "$source",
                            }
                        },
                        dealAmount: { $ifNull: ["$dealAmount", 0] },
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
                                $cond: [{ $eq: ["$dealStatus", "Won"] }, "$dealAmount", 0]
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
                        wonAmount: { $round: ["$wonAmount", 2] },
                        revenueShare: {
                            $cond: [
                                { $gt: ["$count", 0] },
                                { $round: [{ $multiply: [{ $divide: ["$wonAmount", { $max: ["$totalAmount", 1] }] }, 100] }, 2] },
                                0,
                            ]
                        }
                    }
                },
                { $sort: { count: -1 } }
            ])




        }

        // Division Performance
        let divisionPerformanceData = null

        if (want("division")) {
            const divMatch = buildBaseMatch({
                division: { $nin: [null, "", "N/A"] }
            })
            // If caller already filtered division, keep it only exclude N/A on top
            if (divisionFilter?.length) divMatch.division = { $in: divisionFilter }
            else divMatch.division = { $nin: [null, "", "N/A"] }

            const divAgg = await Data.aggregate([
                { $match: divMatch },
                {
                    $group: {
                        _id: "$division",
                        leads: { $sum: 1 },
                        totalAmount: { $sum: { $ifNull: ["$dealAmount", 0] } },
                        wonAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$dealStatus", "Won"] },
                                    { $ifNull: ["$dealAmount", 0] },
                                    0
                                ]
                            }
                        },
                        wonDeals: {
                            $sum: { $cond: [{ $eq: ["$dealStatus", "Won"] }, 1, 0] }
                        }
                    }
                },
                { $sort: { wonAmount: -1 } }
            ])

            const totalWonRevenue = divAgg.reduce((s, i) => s + i.wonAmount, 0)

            divisionPerformanceData = divAgg.map((item) => ({
                division: item._id,
                leads: item.leads,
                wonDeals: item.wonDeals,
                wonAmount: item.wonAmount,
                totalAmount: item.totalAmount,
                revenueShare:
                    totalWonRevenue > 0
                        ? Number(((item.wonAmount / totalWonRevenue) * 100).toFixed(2))
                        : 0
            }))
        }

        // Top Products
        let topProducts = null
        if (want("products")) {
            const productMatchBase = { ...baseMatch }
            const productMatchExtra = { "products.productName": { $ne: "N/A" } }
            if (productNameFilter?.length) productMatchExtra["products.productName"] = { $in: productNameFilter }

            topProducts = await Data.aggregate([
                { $match: productMatchBase },
                { $unwind: "$products" },
                { $match: productMatchExtra },
                {
                    $group: {
                        _id: "$products.productName",
                        count: { $sum: 1 },
                        totalAmount: { $sum: { $ifNull: ["$dealAmount", 0] } },
                        wonAmount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$dealStatus", "Won"] },
                                    { $ifNull: ["$dealAmount", 0] },
                                    0
                                ]
                            }
                        },
                        wonCount: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$dealStatus", "Won"] },
                                    1,
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
                        wonAmount: { $round: ["$wonAmount", 2] },
                        wonCount: 1,
                    }
                },
                { $sort: { wonAmount: -1 } },
                { $limit: 10 }
            ])

        }

        // Dealstatus 
        let periodDealStatus = null

        if (want("dealStatus")) {
            periodDealStatus = await Data.aggregate([
                { $match: baseMatch },
                {
                    $group: {
                        _id: "$dealStatus",
                        count: { $sum: 1 },
                        totalAmount: { $sum: { $ifNull: ["$dealAmount", 0] } },
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
                { $sort: { count: -1 } }
            ])
        }

        // Sales Person Performance
        let salesPersonPerformance = null

        if (want("salesPerson")) {
            salesPersonPerformance = await Data.aggregate([
                { $match: baseMatch },
                {
                    $group: {
                        _id: "$assignToSalesPerson",
                        totalLeads: { $sum: 1 },
                        totalAmount: { $sum: { $ifNull: ["$dealAmount", 0] } },
                        wonDeals: {
                            $sum: {
                                $cond: [{
                                    $eq: ["$dealStatus", "Won"]
                                }, 1, 0]
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
                        },
                        lostDeals: {
                            $sum: { $cond: [{ $eq: ["$dealStatus", "Lost"] }, 1, 0] }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        salesPerson: "$_id",
                        totalLeads: 1,
                        wonDeals: 1,
                        lostDeals: 1,
                        totalAmount: { $round: ["$totalAmount", 2] },
                        wonAmount: { $round: ["$wonAmount", 2] },
                        winRate: {
                            $cond: [
                                { $gt: ["$totalLeads", 0] },
                                { $round: [{ $multiply: [{ $divide: ["$wonDeals", "$totalLeads"] }, 100] }, 2] },
                                0
                            ]
                        }
                    }
                },
                { $sort: { wonDeals: -1 } }
            ])
        }

        let followUpAnalytics = null

        if (want("followUps")) {

            const [channelBreakdown, gapDistribution, followUpOverTime] =
                await Promise.all([
                    // Aggregate 1
                    Data.aggregate([
                        { $match: baseMatch },
                        { $unwind: "$followUps" },
                        {
                            $group: {
                                _id: "$followUps.followUpTakenVia",
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } }
                    ]),

                    // Aggregate 2
                    Data.aggregate([
                        { $match: baseMatch },
                        {
                            $unwind: {
                                path: "$followUps",
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                avgGap: { $avg: "$followUps.followUpGap" },
                                minGap: { $min: "$followUps.followUpGap" },
                                maxGap: { $max: "$followUps.followUpGap" }
                            }
                        }
                    ]),

                    // Aggregate 3
                    Data.aggregate([
                        { $match: baseMatch },
                        {
                            $project: {
                                followUpCount: {
                                    $size: { $ifNull: ["$followUps", []] }
                                }
                            }
                        },
                        {
                            $group: {
                                _id: "$followUpCount",
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $sort: { _id: 1 }
                        }
                    ])
                ]);

            followUpAnalytics = {
                channelBreakdown,
                gapStats: gapDistribution[0] || {
                    avgGap: 0,
                    minGap: 0,
                    maxGap: 0
                },
                followUpBuckets: followUpOverTime
            };
        }

        const appliedFilters = {
            dateField: resolvedDateField,
            dateRange: { from: dateStart, to: dateEnd },
            dealStatus: dealStatusFilter || "all",
            division: divisionFilter || "all",
            source: sourceFilter || "all",
            assignToSalesPerson: salesPersonFilter || "all",
            amountrange: {
                min: minAmount !== undefined ? Number(minAmount) : null,
                max: maxAmount !== undefined ? Number(maxAmount) : null
            },
            productName: productNameFilter || "all",
            sections: sectionsFilter ? [...sectionsFilter] : "all"
        }

        return res.status(200).json({
            success: true,
            appliedFilters,
            overview,
            charts: {
                leadSourceData,
                divisionPerformance: divisionPerformanceData,
                topProducts,
                periodDealStatus,
                salesPersonPerformance
            },
            followUpAnalytics
        })
    } catch (error) {
        console.error("Analytics API error:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch analytics data",
            error: error.message
        })
    }
}

module.exports = { getReportsDashboardData, getDetailedAnalyticsData }
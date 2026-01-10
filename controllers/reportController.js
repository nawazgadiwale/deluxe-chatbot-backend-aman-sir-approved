const Quote = require('../models/Quote')
const User = require('../models/User')

const getReportsData = async (req, res) => {
    try {
        const totalSales = await Quote.countDocuments()
        const totalQuotes = await Quote.countDocuments({ moveToInvoice: false })
        const totalInvoices = await Quote.countDocuments({ moveToInvoice: true })
        const completedOrders = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: true })
        const orderSales = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: false, assignToDepartment: 'Sales' })
        const orderDesign = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: false, assignToDepartment: 'Designer' })
        const orderProduction = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: false, assignToDepartment: 'Production' })
        const orderFinishing = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: false, assignToDepartment: 'Finishing' })
        const orderOperation = await Quote.countDocuments({ moveToInvoice: true, isOperationCompleted: false, assignToDepartment: 'Operation' })
        const totalEmployees = await User.countDocuments()
        const admins = await User.countDocuments({ role: 'admin' })
        const subAdmins = await User.countDocuments({ role: 'sub-admin' })
        const salesPeoples = await User.countDocuments({ role: 'sales' })
        const designPeoples = await User.countDocuments({ role: 'design' })
        const productionPeoples = await User.countDocuments({ role: 'production' })
        const finishingPeoples = await User.countDocuments({ role: 'finishing' })
        const operationPeoples = await User.countDocuments({ role: 'operation' })

        res.status(200).json({
            success: true,
            message: "Reports Data",
            salesOrders: totalSales,
            quotes: totalQuotes,
            invoices: totalInvoices,
            orders: {
                complete: completedOrders,
                sales: orderSales,
                design: orderDesign,
                production: orderProduction,
                finishing: orderFinishing,
                operation: orderOperation
            },
            user: {
                users: totalEmployees,
                admin: admins,
                subAdmin: subAdmins,
                sales: salesPeoples,
                design: designPeoples,
                production: productionPeoples,
                finishing: finishingPeoples,
                operation: operationPeoples
            }
        })
    } catch (error) {
        console.error("Error getting the reports data:", error.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// monthly graph data
const getMonthlyOrderGraph = async (req, res) => {
    try {
        const year = req.query.year
            ? Number(req.query.year)
            : new Date().getFullYear()

        const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
        const endDate = new Date(`${year}-12-31T23:59:59.999z`)

        const data = await Quote.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    totalCount: { $sum: 1 },
                    totalQuotesAmount: { $sum: "$amount" },
                    totalInvoices: {
                        $sum: {
                            $cond: [{ $eq: ["$moveToInvoice", true] }, 1, 0]
                        }
                    },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $eq: ["$moveToInvoice", true] },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ])

        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]

        const graphData = months.map((month, index) => {
            const found = data.find(d => d._id === index + 1)
            return {
                month,
                totalInvoices: found ? found.totalInvoices : 0,
                totalQuotesAmount: found ? Number(found.totalQuotesAmount.toFixed(2)) : 0,
                totalCount: found ? found.totalCount : 0,
                totalAmount: found ? Number(found.totalAmount.toFixed(2)) : 0
            }
        })

        return res.status(200).json({
            success: true,
            year,
            data: graphData,
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "failed to fetch graph data!"
        })
    }
}

const getDivisionWiseGraph = async (req, res) => {
    try {

        const year = req.query.year
            ? Number(req.query.year)
            : new Date().getFullYear()

        const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
        const endDate = new Date(`${year}-12-31T23:59:59.999z`)

        const ALL_DIVISIONS = [
            "Store Branding",
            "Signage",
            "Event (Fashion & Fabric)",
            "Event (Digital)",
            "Gift",
            "Stationery",
            "Gifts",
            "Gift & Stationery"
        ]

        const result = await Quote.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: "$division",
                    totalCount: { $sum: 1 },
                    totalInvoiceCount: {
                        $sum: {
                            $cond: [{ $eq: ["$moveToInvoice", true] }, 1, 0]
                        }
                    },
                }
            }
        ])

        const divisionMap = {}
        result.forEach(item => {
            divisionMap[item._id] = {
                totalCount: item.totalCount,
                totalInvoiceCount: item.totalInvoiceCount
            }
        })

        const finalData = ALL_DIVISIONS.map(div => ({
            division: div,
            totalCount: divisionMap[div]?.totalCount || 0,
            totalInvoiceCount: divisionMap[div]?.totalInvoiceCount || 0
        }))

        return res.status(200).json({
            success: true,
            data: finalData
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch division wise graph data!"
        })
    }
}

const getGraphDataBySalesPerson = async (req, res) => {
    try {
        const year = req.query.year
            ? Number(req.query.year)
            : new Date().getFullYear()

        const startDate = new Date(`${year}-01-01T00:00:00.000Z`)
        const endDate = new Date(`${year}-12-31T23:59:59.999z`)

        const ALL_SALES_PERSON = [
            "Huzaifa",
            "Aliasgar",
            "Nishan",
            "Rizwan",
            "Arif",
            "Nayeem",
            "Azmat",
            "Ziyad",
            "Umair",
            "Wajid",
            "Junaid",
            "Zohaib",
            "Saniya",
            "Mohsin",
            "Aaliya",
            "Zeedan",
            "Misba",
            "Muazzam",
            "Hafsa",
            "Sharifa",
            "Salman",
            "Atif"
        ]

        const result = await Quote.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: "$salesPerson",
                    totalInvoiceCount: {
                        $sum: {
                            $cond: [{ $eq: ["$moveToInvoice", true] }, 1, 0]
                        }
                    },
                    totalPendingCount: {
                        $sum: {
                            $cond: [{ $eq: ["$moveToInvoice", false] }, 1, 0]
                        }
                    }
                }
            }
        ])

        const salespersonMap = {}
        result.forEach(item => {
            salespersonMap[item._id] = {
                totalInvoiceCount: item.totalInvoiceCount,
                totalPendingCount: item.totalPendingCount
            }
        })

        const finalData = ALL_SALES_PERSON.map(sal => ({
            salesPerson: sal,
            totalInvoiceCount: salespersonMap[sal]?.totalInvoiceCount || 0,
            totalPendingCount: salespersonMap[sal]?.totalPendingCount || 0
        }))

        return res.status(200).json({
            success: true,
            data: finalData
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch sales person graph data!"
        })
    }
}

module.exports = { getReportsData, getMonthlyOrderGraph, getDivisionWiseGraph, getGraphDataBySalesPerson }
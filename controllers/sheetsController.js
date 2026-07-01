const Sheets = require("../models/Sheets")

const createSheet = async (req, res) => {
    try {
        const { sheetTitle, sheetCategory, sheetLink, createdBy } = req.body

        if (!sheetTitle || !sheetCategory || !sheetLink) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required.'
            })
        }

        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: 'Authentication error.'
            })
        }

        // validate url
        try {
            new URL(sheetLink)
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid sheet URL.'
            })
        }

        // Get next sheet number
        const lastSheet = await Sheets.findOne().sort({ sheetNo: -1 })
        const sheetNo = lastSheet ? lastSheet.sheetNo + 1 : 1

        const sheet = await Sheets.create({
            createdBy,
            sheetNo,
            sheetTitle,
            sheetCategory,
            sheetLink
        })

        return res.status(200).json({
            success: true,
            message: 'Sheet created successfully.',
            data: sheet
        })
    } catch (error) {
        console.error('Internal Server Error', error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    } 
}

const getSheets = async (req, res) => {
    try {
        const { page, limit = 10, search = "", category = "" } = req.query
        const query = {}

        // Search by sheet title
        if (search) {
            query.sheetTitle = {
                $regex: search,
                $options: 'i'
            }
        }

        // Filter by category
        if (category) {
            query.sheetCategory = category
        }

        const totalSheets = await Sheets.countDocuments(query)

        const sheets = await Sheets.find(query)
        .populate('createdBy', 'name')
        .sort({ sheetNo: 1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))

        return res.status(200).json({
            success: true,
            count: sheets.length,
            totalSheets,
            currentPage: Number(page),
            totalPages: Math.ceil(totalSheets / limit),
            data: sheets
        })
    } catch (error) {
        console.error('Internal Server Error', error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const getSheetsDashboard = async (req, res) => {
    try {
        const totalSheets = await Sheets.countDocuments()
        const categoryStats = await Sheets.aggregate([
            {
                $group: {
                    _id: "$sheetCategory",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ])

        res.status(200).json({
            success: true,
            data: {
                totalSheets,
                categoryStats
            }
        })
    } catch (error) {
        console.error('Internal Server Error', error)
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

module.exports = { createSheet, getSheets, getSheetsDashboard }
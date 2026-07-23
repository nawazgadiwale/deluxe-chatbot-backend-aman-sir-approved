const Ot = require("../models/Ot")
const User = require("../models/User")
const { mongoose } = require('mongoose')

const addOverTime = async (req, res) => {
    try {
        const { createdBy, employeeId, otAddedDate, startTime, endTime, details, otTime, jobOwner } = req.body

        const employee = await User.findById(employeeId)

        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: "Created by is not found"
            })
        }

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            })
        }

        if (!otAddedDate) {
            return res.status(400).json({
                success: false,
                message: "OT Added Date is required"
            })
        }

        if (!startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Start time and end time are required"
            })
        }

        if (!otTime) {
            return res.status(400).json({
                success: false,
                message: "OT Time is required"
            })
        }

        if (!details) {
            return res.status(400).json({
                success: false,
                message: "Client Details / Job Details are required"
            })
        }

        if (!jobOwner) {
            return res.status(400).json({
                success: false,
                message: "Job owner need to be selected"
            })
        }

        const ot = await Ot.create({
            createdBy,
            employee,
            otAddedDate,
            startTime,
            endTime,
            details,
            otTime: Number(otTime),
            jobOwner
        })

        return res.status(200).json({
            success: true,
            message: "Over Time added successfully.",
            data: ot
        })

    } catch (error) {
        console.error("Error adding over time record:", error)
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

const getAllOT = async (req, res) => {
    try {
        let {
            employee,
            month,
            year,
            page = 1,
            limit = 10
        } = req.query

        page = Number(page)
        limit = Number(limit)

        const today = new Date()

        month = month ? Number(month) : today.getUTCMonth() + 1
        year = year ? Number(year) : today.getUTCFullYear()

        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 1)

        const filter = {
            otAddedDate: {
                $gte: startDate,
                $lt: endDate
            }
        }

        if (employee) {
            const employeeIds = employee
                .split(',')
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id))

            filter.employee = {
                $in: employeeIds
            }
        }

        const total = await Ot.countDocuments(filter)

        const data = await Ot.find(filter)
            .populate('employee', 'name employeeId designation workingCountry')
            .populate('jobOwner', 'name')
            .populate('createdBy', 'name')
            .sort({ otAddedDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit)

        const totalOtHours = await Ot.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    totalHours: {
                        $sum: "$otTime"
                    }
                }
            }
        ])

        return res.status(200).json({
            success: true,
            data,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            totalOtHours: totalOtHours[0]?.totalHours || 0
        })

    } catch (error) {
        console.error("Error while fetching over time records", error)
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

const updateOt = async (req, res) => {
    try {
        const { otId } = req.params

        const {
            employee,
            otAddedDate,
            startTime,
            endTime,
            details,
            otTime,
            jobOwner
        } = req.body

        const ot = await Ot.findById(otId)

        if (!ot) {
            return res.status(404).json({
                success: false,
                message: "Overtime not found."
            })
        }

        ot.employee = employee ?? ot.employee
        ot.otAddedDate = otAddedDate ?? ot.otAddedDate
        ot.startTime = startTime ?? ot.startTime
        ot.endTime = endTime ?? ot.endTime
        ot.details = details ?? ot.details
        ot.otTime = otTime ?? ot.otTime
        ot.jobOwner = jobOwner ?? ot.jobOwner

        await ot.save()

        return res.status(200).json({
            success: true,
            message: "Overtime updated successfully.",
            data: ot
        })

    } catch (error) {
        console.error("Error while updating overtime record", error)
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

const deleteOt = async (req, res) => {
    try {
        const { otId } = req.params

        const ot = await Ot.findById(otId)

        if (!ot) {
            return res.status(404).json({
                success: false,
                message: "Overtime not found."
            })
        }

        await Ot.findByIdAndDelete(otId)

        return res.status(200).json({
            success: true,
            message: 'Overtime deleted successfully.'
        })
    } catch (error) {
        console.error("Error while deleting overtime record", error)
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}

module.exports = { addOverTime, getAllOT, updateOt, deleteOt }
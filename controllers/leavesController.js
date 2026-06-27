const Leaves = require("../models/Leaves")
const User = require("../models/User")

const applyLeave = async (req, res) => {
    try {
        const { fromDate, toDate, reason } = req.body

        const employee = req.user.id
        let leaveCategory = 'Paid'

        if (new Date(fromDate) > new Date(toDate)) {
            return res.status(400).json({
                success: false,
                message: 'From date cannot be greater than To date.'
            })
        }

        const leaveDays = Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1

        // Check overlapping leave
        const overlap = await Leaves.findOne({
            employee,
            status: { $ne: 'Cancelled' },
            fromDate: { $lte: toDate },
            toDate: { $gte: fromDate }
        })

        if (overlap) {
            return res.status(400).json({
                success: false,
                message: 'Leave already exists for selected dates.'
            })
        }

        if (leaveCategory === 'Paid') {
            const user = await User.findById(employee).select('joiningDate')
            if (!user || !user.joiningDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Joining date not found'
                })
            }

            const joiningDate = new Date(user.joiningDate)
            const leaveStartDate = new Date(fromDate)

            // Calculate current leave cycle
            let cycleStart = new Date(joiningDate)
            cycleStart.setFullYear(leaveStartDate.getFullYear())

            // If anniversary hasn't come yet in this year
            // current cycle started last year
            if (leaveStartDate < cycleStart) {
                cycleStart.setFullYear(cycleStart.getFullYear() - 1)
            }

            const cycleEnd = new Date(cycleStart)
            cycleEnd.setFullYear(cycleEnd.getFullYear() + 1)
            cycleEnd.setDate(cycleEnd.getDate() - 1)

            const leaves = await Leaves.aggregate([
                {
                    $match: {
                        employee: user._id,
                        leaveCategory: 'Paid',
                        status: {
                            $in: ['Pending', 'Approved']
                        },
                        fromDate: {
                            $gte: cycleStart,
                            $lte: cycleEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: '$leaveDays'
                        }
                    }
                }
            ])


            // if (usedLeaves + leaveDays > 15) {
            //     return res.status(400).json({
            //         success: false,
            //         message: `Only ${15 - usedLeaves} paid leave(s) remaining in your current leave cycle`
            //     })
            // }

            const usedLeaves = leaves[0]?.total || 0
            const totalLeavesAfterApply = usedLeaves + leaveDays

            // 15 or less => Paid
            // More than 15 => UnPaid
            leaveCategory = totalLeavesAfterApply > 15 ? "UnPaid" : "Paid";
        }

        const leave = await Leaves.create({
            employee,
            fromDate,
            toDate,
            leaveDays,
            leaveCategory,
            reason
        })

        res.status(200).json({
            success: true,
            data: leave
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const getLeaves = async (req, res) => {
    try { 
        const { page = 1, limit = 10, employee, status, leaveCategory, year } = req.query

        const query = {}

        // employee filter
        if (employee) {
            query.employee = employee
        }

        // status filter
        if (status) {
            query.status = status
        }

        // leave category filter
        if (leaveCategory) {
            query.leaveCategory = leaveCategory
        }

        // year filter
        if (year) {
            query.fromDate = {
                $gte: new Date(`${year}-01-01`),
                $lte: new Date(`${year}-12-31T23:59:59.999Z`)
            }
        }

        const total = await Leaves.countDocuments(query)

        const leaves = await Leaves.find(query)
        .populate('employee', 'name designation')
        .populate('approvedBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))

        res.status(200).json({
            success: true,
            total,
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
            data: leaves
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

module.exports = { applyLeave, getLeaves }
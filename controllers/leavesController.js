const Leaves = require("../models/Leaves")
const User = require("../models/User")
const { sendLeaveMessage } = require("../services/telegramService")

const PAID_QUOTA = { UAE: 30, DEFAULT: 15 }

// Compute the current employee-anniversary leave cycle window for give joining date,
// relative to a reference data.
// Cycle resets to 0 every year on the joining-date anniversary

const getCycleWindow = (joinDate, referenceDate) => {
    let cycleStartYear = referenceDate.getUTCFullYear()
    let cycleStart = new Date(Date.UTC(cycleStartYear, joinDate.getUTCMonth(), joinDate.getUTCDate()))

    if (referenceDate < cycleStart) {
        cycleStartYear--
        cycleStart = new Date(Date.UTC(cycleStartYear, joinDate.getUTCMonth(), joinDate.getUTCDate()))
    }

    const cycleEnd = new Date(Date.UTC(cycleStartYear + 1, joinDate.getUTCMonth(), joinDate.getUTCDate()))
    cycleEnd.setUTCDate(cycleEnd.getUTCDate() - 1)

    return { cycleStart, cycleEnd }
}

const getPaidQuota = (employee) =>
    employee.workingCountry === "UAE" ? PAID_QUOTA.UAE : PAID_QUOTA.DEFAULT

const calculateLeaveDays = (fromDate, toDate, type) => {
    if (type === 'Half') {
        return 0.5
    }

    const start = new Date(fromDate)
    const end = new Date(toDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 0
    }

    start.setUTCHours(0, 0, 0, 0)
    end.setUTCHours(0, 0, 0, 0)

    if (start > end) {
        return 0
    }

    let totalDays = 0

    const current = new Date(start)

    while (current <= end) {
        const dayOfWeek = current.getUTCDay()

        if (dayOfWeek !== 0) {
            totalDays += 1
        }

        current.setUTCDate(current.getUTCDate() + 1)
    }

    return totalDays
}

// Apply for leave, automatically splitting into Paid/Unpaid based on remaining quota
const addLeave = async (req, res) => {
    try {
        const {
            createdBy,
            employeeId,
            fromDate,
            toDate,
            type,
            halfDay
        } = req.body

        // Validate leave type first
        if (!["Half", "Full"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "type must be 'Half' or 'Full'"
            })
        }

        if (type === 'Half') {
            if (!['First', 'Second'].includes(halfDay)) {
                return res.status(400).json({
                    success: false,
                    message: 'HalfDay must be "First" or "Second" when type is "Half"'
                })
            }
        } else {
            if (halfDay !== undefined && halfDay !== null) {
                return res.status(400).json({
                    success: false,
                    message: 'HalfDay should only be provided for Half day leave'
                })
            }
        }

        // Validate dates
        const startDate = new Date(fromDate)
        const endDate = new Date(toDate)

        if (
            isNaN(startDate.getTime()) ||
            isNaN(endDate.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid fromDate or toDate"
            })
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: "fromDate cannot be greater than toDate"
            })
        }

        if (type === 'Half') {
            const startUTC = new Date(startDate)
            const endUTC = new Date(endDate)

            startUTC.setUTCHours(0, 0, 0, 0)
            endUTC.setUTCHours(0, 0, 0, 0)

            if (startUTC.getTime() !== endUTC.getTime()) {
                return res.status(400).json({
                    success: false,
                    message: 'Half day leave can only be applied for one day'
                })
            }

            if (startUTC.getUTCDay() === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Leave cannot be applied on Sunday'
                })
            }
        }

        // Calculate leave days from dates
        // Do NOT trust leaveDays coming from frontend
        const requestedDays = calculateLeaveDays(
            fromDate,
            toDate,
            type
        )

        if (requestedDays <= 0) {
            return res.status(400).json({
                success: false,
                message: "Selected dates contain no valid leave days."
            })
        }

        // Fetch employee
        const employee = await User.findById(employeeId)

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            })
        }

        if (!employee.joiningDate) {
            return res.status(400).json({
                success: false,
                message: "Employee does not have a joining date configured."
            })
        }

        // Total paid leave quota
        const totalPaidQuota = getPaidQuota(employee)

        // Current leave cycle
        const joinDate = new Date(employee.joiningDate)
        const leaveStartDate = new Date(fromDate)

        const {
            cycleStart,
            cycleEnd
        } = getCycleWindow(
            joinDate,
            leaveStartDate
        )

        // Paid leaves already taken in current cycle
        const takenLeaves = await Leaves.find({
            employee: employeeId,
            leaveCategory: "Paid",
            fromDate: {
                $gte: cycleStart,
                $lte: cycleEnd
            }
        })

        const totalPaidLeavetakenBefore =
            takenLeaves.reduce(
                (sum, leave) => sum + Number(leave.leaveDays || 0),
                0
            )

        // Remaining paid balance
        const remainingPaidBalance = Math.max(
            0,
            totalPaidQuota - totalPaidLeavetakenBefore
        )

        // Split requested leave
        let paidDaysToApply = 0
        let unpaidDaysToApply = 0

        if (remainingPaidBalance >= requestedDays) {
            paidDaysToApply = requestedDays
        } else {
            paidDaysToApply = remainingPaidBalance
            unpaidDaysToApply =
                requestedDays - remainingPaidBalance
        }

        const savedLeaves = []

        const savedHalfDay =
            type === "Half"
                ? halfDay
                : null

        // -----------------------------
        // PAID LEAVE
        // -----------------------------
        if (paidDaysToApply > 0) {
            const paidLeave = new Leaves({
                createdBy,
                employee: employeeId,
                fromDate,
                toDate,
                leaveDays: paidDaysToApply,
                leaveCategory: "Paid",
                type: paidDaysToApply === 0.5
                    ? "Half"
                    : "Full",
                halfDay: paidDaysToApply === 0.5
                    ? savedHalfDay
                    : null
            })

            savedLeaves.push(
                await paidLeave.save()
            )
        }

        // -----------------------------
        // UNPAID LEAVE
        // -----------------------------
        if (unpaidDaysToApply > 0) {
            const unpaidLeave = new Leaves({
                createdBy,
                employee: employeeId,
                fromDate,
                toDate,
                leaveDays: unpaidDaysToApply,
                leaveCategory: "UnPaid",
                type: unpaidDaysToApply === 0.5
                    ? "Half"
                    : "Full",
                halfDay: unpaidDaysToApply === 0.5
                    ? savedHalfDay
                    : null
            })

            savedLeaves.push(
                await unpaidLeave.save()
            )
        }

        // Total paid leaves after this request
        const totalPaidLeavesTakenTillNow =
            totalPaidLeavetakenBefore +
            paidDaysToApply

        // Telegram message
        const leaveWithUser = await Leaves
            .findById(savedLeaves[0]._id)
            .populate(
                "employee",
                "name workingCountry"
            )

        // await sendLeaveMessage(leaveWithUser)

        // Response
        return res.status(201).json({
            success: true,
            message: "Leave added successfully!",

            cycle: {
                currentCycleStart:
                    cycleStart
                        .toISOString()
                        .split("T")[0],

                currentCycleEnd:
                    cycleEnd
                        .toISOString()
                        .split("T")[0]
            },

            summary: {
                totalRequested: requestedDays,

                allocatedPaid:
                    paidDaysToApply,

                allocatedUnpaid:
                    unpaidDaysToApply,

                totalPaidQuota,

                totalPaidLeavesTakenTillNow,

                remainingPaidBalance:
                    Math.max(
                        0,
                        totalPaidQuota -
                        totalPaidLeavesTakenTillNow
                    )
            },

            details: savedLeaves
        })

    } catch (error) {
        console.error(
            "Internal Server Error",
            error
        )

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

const getLeavesByEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params

        let { page = 1, limit = 10 } = req.query

        page = parseInt(page)
        limit = parseInt(limit)

        if (isNaN(page) || page < 1) page = 1
        if (isNaN(limit) || limit < 1) limit = 10

        // Employee
        const employee = await User.findById(employeeId)

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            })
        }

        if (!employee.joiningDate) {
            return res.status(400).json({
                success: false,
                message: "Employee does not have a joining date configured."
            })
        }

        // Paid leave quota
        const totalPaidQuota = getPaidQuota(employee)

        const joinDate = new Date(employee.joiningDate)
        const today = new Date()

        const { cycleStart, cycleEnd } = getCycleWindow(joinDate, today)

        // Total leaves count
        const totalRecords = await Leaves.countDocuments({
            employee: employeeId
        })

        // Paginated leaves (List View)
        const paginatedLeaves = await Leaves.find({
            employee: employeeId
        })
            .populate("createdBy", "name")
            .populate("employee", "name")
            .sort({ fromDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit)

        // All leaves (Summary + Calendar)
        const allLeaves = await Leaves.find({
            employee: employeeId
        })
            .populate("createdBy", "name")
            .populate("employee", "name")
            .sort({ fromDate: -1 })

        // Paid leaves in current cycle
        const currentCyclePaidLeaves = allLeaves.filter(
            (leave) =>
                leave.leaveCategory === "Paid" &&
                new Date(leave.fromDate) >= cycleStart &&
                new Date(leave.fromDate) <= cycleEnd
        )

        const totalPaidLeavesTakenTillNow =
            currentCyclePaidLeaves.reduce(
                (sum, leave) => sum + leave.leaveDays,
                0
            )

        const remainingPaidBalance = Math.max(
            0,
            totalPaidQuota - totalPaidLeavesTakenTillNow
        )

        // Unpaid leaves in current cycle
        const currentCycleUnpaidLeaves = allLeaves.filter(
            (leave) =>
                leave.leaveCategory === "UnPaid" &&
                new Date(leave.fromDate) >= cycleStart &&
                new Date(leave.fromDate) <= cycleEnd
        )

        const totalUnpaidLeavesTakenTillNow =
            currentCycleUnpaidLeaves.reduce(
                (sum, leave) => sum + leave.leaveDays,
                0
            )

        // List View History (Paginated)
        const formattedHistory = paginatedLeaves.map((leave) => ({
            id: leave._id,
            employeeName: leave.employee?.name || null,
            leaveCategory: leave.leaveCategory,
            leaveDays: leave.leaveDays,
            type: leave.type,
            halfDay: leave.halfDay,
            fromDate: leave.fromDate.toISOString().split("T")[0],
            toDate: leave.toDate.toISOString().split("T")[0],
            createdBy: leave.createdBy?.name || null
        }))

        // Calendar History (Full)
        const formattedCalendarHistory = allLeaves.map((leave) => ({
            id: leave._id,
            employeeName: leave.employee?.name || null,
            leaveCategory: leave.leaveCategory,
            leaveDays: leave.leaveDays,
            type: leave.type,
            halfDay: leave.halfDay,
            fromDate: leave.fromDate.toISOString().split("T")[0],
            toDate: leave.toDate.toISOString().split("T")[0],
            createdBy: leave.createdBy?.name || null
        }))

        return res.status(200).json({
            success: true,
            message: "Leaves fetched successfully",

            cycle: {
                currentCycleStart:
                    cycleStart.toISOString().split("T")[0],
                currentCycleEnd:
                    cycleEnd.toISOString().split("T")[0]
            },

            summary: {
                totalPaidQuota,
                totalPaidLeavesTakenTillNow,
                totalUnpaidLeavesTakenTillNow,
                remainingPaidBalance
            },

            // Table
            history: formattedHistory,

            // Calendar
            calendarHistory: formattedCalendarHistory,

            pagination: {
                page,
                limit,
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
                hasPrev: page > 1,
                hasNext:
                    page < Math.ceil(totalRecords / limit)
            }
        })
    } catch (error) {
        console.error(
            "Error fetching employee leaves summary:",
            error
        )

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

const getLeavesByYear = async (req, res) => {
    try {
        const year = parseInt(req.params.year, 10)
        if (isNaN(year)) {
            return res.status(400).json({
                success: false,
                message: "Invalid year"
            })
        }

        const yearStart = new Date(Date.UTC(year, 0, 1))
        const yearEnd = new Date(Date.UTC(year + 1, 0, 1)) // exclusive

        // Any leave whose range overlaps [yearStart, yearEnd]
        const leaves = await Leaves.find({
            fromDate: { $lt: yearEnd },
            toDate: { $gte: yearStart }
        }).populate('employee', 'name email designation workingCountry')

        const calendar = {}

        leaves.forEach((leave) => {
            const rangeStart = new Date(Math.max(new Date(leave.fromDate), yearStart))
            const rangeEnd = new Date(Math.min(new Date(leave.toDate), yearEnd.getTime() - 1))

            const cursor = new Date(rangeStart)
            while (cursor <= rangeEnd) {
                const key = cursor.toISOString().split('T')[0]

                if (!calendar[key]) calendar[key] = []
                calendar[key].push({
                    employeeId: leave.employee?._id,
                    name: leave.employee?.name || 'Unknown',
                    email: leave.employee?.email,
                    designation: leave.employee?.designation,
                    workingCountry: leave.employee?.workingCountry,
                    leaveDays: leave.leaveDays,
                    leaveCategory: leave.leaveCategory,
                    type: leave.type,
                    fromDate: leave.fromDate,
                    toDate: leave.toDate
                })

                cursor.setUTCDate(cursor.getUTCDate() + 1)
            }
        })

        return res.status(200).json({
            success: true,
            year,
            calendar
        })
    } catch (error) {
        console.error("Error fetching leaves calendar:", error)
        return res.status(500).json({
            success: false,
            message: "internal Server Error"
        })
    }
}

// Update leave api
const updateLeave = async (req, res) => {
    try {
        const { leaveId } = req.params

        const {
            fromDate,
            toDate,
            type,
            halfDay
        } = req.body

        const leave = await Leaves.findById(leaveId)

        if (!leave) {
            return res.status(404).json({
                success: false,
                message: "Leave not found"
            })
        }

        const splitLeaves = await Leaves.find({
            employee: leave.employee,
            fromDate: leave.fromDate,
            toDate: leave.toDate
        })

        if (splitLeaves.length > 1) {
            return res.status(400).json({
                success: false,
                message:
                    "This leave was split into Paid/UnPaid. Please delete and recreate."
            })
        }

        if (!["Half", "Full"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid leave type"
            })
        }

        if (type === "Half") {

            if (!["First", "Second"].includes(halfDay)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "halfDay must be 'First' or 'Second' for Half day leave"
                })
            }

        } else {

            // Full day should not have First / Second
            if (
                halfDay !== undefined &&
                halfDay !== null &&
                halfDay !== ""
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "halfDay should only be provided for Half day leave"
                })
            }
        }

        const from = new Date(fromDate)

        const to = new Date(
            type === "Half"
                ? fromDate
                : toDate
        )


        if (
            isNaN(from.getTime()) ||
            isNaN(to.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid date(s) supplied"
            })
        }

        if (to < from) {
            return res.status(400).json({
                success: false,
                message:
                    "To date cannot be before from date"
            })
        }

        if (type === "Half") {

            const fromDay = new Date(from)
            const toDay = new Date(to)

            fromDay.setUTCHours(0, 0, 0, 0)
            toDay.setUTCHours(0, 0, 0, 0)

            if (
                fromDay.getTime() !==
                toDay.getTime()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Half day leave can only be applied for one date"
                })
            }


            // Sunday check
            if (fromDay.getUTCDay() === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Leave cannot be applied on Sunday"
                })
            }
        }

        let leaveDays = 0


        if (type === "Half") {

            leaveDays = 0.5

        } else {

            const start = new Date(from)
            const end = new Date(to)

            start.setUTCHours(0, 0, 0, 0)
            end.setUTCHours(0, 0, 0, 0)

            let current = new Date(start)

            while (current <= end) {

                const dayOfWeek =
                    current.getUTCDay()

                // Sunday = 0
                if (dayOfWeek !== 0) {
                    leaveDays += 1
                }

                current.setUTCDate(
                    current.getUTCDate() + 1
                )
            }
        }


        if (leaveDays <= 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Selected dates contain no valid leave days"
            })
        }

        const overlapping = await Leaves.findOne({
            _id: {
                $ne: leave._id
            },

            employee: leave.employee,

            fromDate: {
                $lte: to
            },

            toDate: {
                $gte: from
            }
        })


        if (overlapping) {

            return res.status(400).json({
                success: false,
                message:
                    "This date range overlaps with an existing leave record"
            })
        }

        leave.fromDate = from
        leave.toDate = to
        leave.leaveDays = leaveDays
        leave.type = type

        // NEW
        leave.halfDay =
            type === "Half"
                ? halfDay
                : null


        await leave.save()

        return res.status(200).json({

            success: true,

            message:
                "Leave updated successfully",

            data: leave
        })


    } catch (error) {

        console.error(
            "Error while updating leave:",
            error
        )

        return res.status(500).json({
            success: false,
            message:
                "Internal Server Error"
        })
    }
}

// Delete leave api
const deleteLeave = async (req, res) => {
    try {
        const { leaveId } = req.params

        const leave = await Leaves.findById(leaveId)

        if (!leave) {
            return res.status(404).json({
                success: false,
                message: "Leave not found"
            })
        }

        await Leaves.deleteMany({
            employee: leave.employee,
            fromDate: leave.fromDate,
            toDate: leave.toDate
        })

        return res.status(200).json({
            success: false,
            message: "Leave deleted successfully"
        })
    } catch (error) {
        console.error("Error while deleting leave", error)
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        })
    }
}

module.exports = { addLeave, getLeavesByEmployee, getLeavesByYear, updateLeave, deleteLeave }
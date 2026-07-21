const Digital = require("../models/Digital")

// Create new digital record 
const createDigitalRecord = async (req, res) => {
    try {
        const { employee, date, workDetails, dayType, team, status, remarks } = req.body

        if (!employee) {
            return res.status(400).json({
                message: 'Employee Id is required!'
            })
        }

        const employeeExists = await User.exists({ _id: employee })

        if (!employeeExists) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found.'
            })
        }

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required!'
            })
        }

        const selectedDate = new Date(date)

        if (isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date."
            })
        }

        // Remove time portion
        selectedDate.setHours(0,0,0,0)

        // Future date validation
        const today = new Date()
        today.setHours(0,0,0,0)

        if (selectedDate > today) {
            return res.status(400).json({
                success: false,
                message: "Future date is not allowed."
            })
        }

        // Sunday validation
        if (selectedDate.getDay() === 0) {
            return res.status(400).json({
                success: false,
                message: "Digital update cannot be created fo Sunday."
            })
        }

        // Work details validation
        if (dayType === "Working-Day" && 
            (!workDetails || !workDetails.trim()) 
        ) {
            return res.status(400).json({
                success: false,
                message: "Work details are required."
            })
        }

        // Check duplicate for same day
        const startOfDay = new Date(selectedDate)
        const endOfDay = new Date(selectedDate)
        endOfDay.setDate(endOfDay.getDate() + 1)

        const alreadyExists = await Digital.findOne({
            employee,
            date: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        })

        if (alreadyExists) {
            return res.status(409).json({
                success: false,
                message: "Digital update already submitted for this date."
            })
        }

        // Generate Ref No
        const lastRecord = await Digital.findOne({ employee })
        .sort({ refNo: -1 })
        .select("refNo")

        const refNo = lastRecord ? lastRecord.refNo + 1 : 1

        const digital = await Digital.create({
            employee,
            refNo,
            date: selectedDate,
            workDetails,
            dayType,
            team,
            status,
            remarks
        })

        return res.status(200).json({
            success: true,
            message: "Digital update created successfully."
        })
    } catch (error) {
        console.error('Error creating digital record', error.message)
        res.status(500).json({
            message: 'Internal Server Error'
        })
    }
}


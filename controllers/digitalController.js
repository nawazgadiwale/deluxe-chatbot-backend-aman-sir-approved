const Digital = require("../models/Digital")

const createDigitalRecord = async (req, res) => {
    try {
        const { employee, date, workDetails, dayType, team, status, remarks } = req.body

        if (!employee) {
            return res.status(400).json({
                message: 'Employee Id is required!'
            })
        }

        if (!date) {
            return res.status(400).json({
                message: 'Date is required!'
            })
        }

        const lastRecord = await Digital.findOne({ employee }).sort({ refNo: -1 })

        const refNo = lastRecord ? lastRecord.refNo + 1 : 1

        const newDigital = new Digital({
            employee,
            refNo,
            date,
            workDetails,
            dayType,
            team,
            status,
            remarks
        })

        const saveDigital = await newDigital.save()

        res.status(200).json({
            success: true,
            message: "New Digital Record Created successfully!",
            digital: saveDigital
        })
    } catch (error) {
        console.error('Error creating digital record', error.message)
        res.status(500).json({
            message: 'Internal Server Error'
        })
    }
}


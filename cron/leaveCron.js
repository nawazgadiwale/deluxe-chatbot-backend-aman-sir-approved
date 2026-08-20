const cron = require('node-cron')
const Leaves = require("../models/Leaves")
const { sendDailyLeaveReminder } = require('../services/telegramService')

cron.schedule(
    "0 10 * * *",
    async () => {
        try {
            const startOfToday = new Date()
            startOfToday.setHours(0, 0, 0, 0)

            const endOfToday = new Date()
            endOfToday.setHours(23, 59, 59, 999)

            const leaves = await Leaves.find({
                fromDate: {
                    $lte: endOfToday
                },
                toDate: {
                    $gte: startOfToday
                }
            })
                .populate("employee", "name workingCountry")
                .sort({ fromDate: 1 })

            if (!leaves.length) {
                return
            }

            await sendDailyLeaveReminder(leaves)

        } catch (error) {
            console.error("Daily Leave Cron Error:", error)
        }
    },
    {
        timezone: "Asia/Kolkata"
    }
)
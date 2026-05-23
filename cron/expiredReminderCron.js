const cron = require('node-cron')
const Reminder = require('../models/Reminder')

cron.schedule('0 0 * * *', async () => {
    try {
        // console.log('Reminder overdue reminder cron')

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const result = await Reminder.updateMany(
            {
                expiryDate: {
                    $lt: today
                },

                reminderStatus: {
                    $nin: [
                        'completed',
                        'canceled',
                        'overdue'
                    ]
                }
            },
            {
                $set: {
                    reminderStatus: 'overdue'
                }
            }
        )

        // console.log(`${result.modifiedCount} reminders marked as overdue`)
    } catch (error) {
        console.error('Overdue reminder cron error', error)
    }
})
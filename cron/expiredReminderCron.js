const cron = require('node-cron')
const Reminder = require('../models/Reminder')

cron.schedule(
    '0 0 * * *',
    async () => {
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            await Reminder.updateMany(
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

        } catch (error) {
            console.error('Overdue reminder cron error', error)
        }
    },
    {
        timezone: 'Asia/Kolkata'
    }
)
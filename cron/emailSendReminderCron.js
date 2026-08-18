const cron = require('node-cron')
const Reminder = require('../models/Reminder')
const sendEmail = require('../services/mailService')

cron.schedule(
    '30 13 * * *',
    async () => {
        try {
            const reminders = await Reminder.find({
                reminderStatus: {
                    $nin: ['completed', 'canceled']
                }
            })
                .populate('category')
                .populate('employee')
                .populate('notifyUsers')

            const today = new Date()
            today.setHours(0, 0, 0, 0)

            let overdueCount = 0

            for (const reminder of reminders) {

                const expiryDate = new Date(reminder.expiryDate)
                expiryDate.setHours(0, 0, 0, 0)

                // MARK OVERDUE
                if (expiryDate < today) {

                    if (reminder.reminderStatus !== 'overdue') {

                        reminder.reminderStatus = 'overdue'

                        await reminder.save()

                        overdueCount++
                    }

                    continue
                }

                // DAYS LEFT
                const diffTime =
                    expiryDate.getTime() - today.getTime()

                const daysLeft = Math.ceil(
                    diffTime / (1000 * 60 * 60 * 24)
                )

                // CATEGORY REMINDER RULES
                const categoryReminders =
                    reminder.category?.reminders || []

                for (const reminderRule of categoryReminders) {

                    const { type, daysBefore } = reminderRule

                    // SEND REMINDER ONLY WHEN MATCHED
                    if (daysLeft === daysBefore) {

                        // CHECK ALREADY SENT
                        const alreadySent =
                            reminder.sentReminders.some(
                                sent =>
                                    sent.reminderType === type &&
                                    sent.daysBefore === daysBefore
                            )

                        if (alreadySent) {
                            continue
                        }

                        // SEND EMAILS
                        for (const user of reminder.notifyUsers) {

                            if (!user?.email) {
                                continue
                            }

                            const mailSent = await sendEmail({
                                to: user.email,

                                subject:
                                    `(${reminder.employee?.name || 'N/A'}) ${reminder.category?.categoryName} - (${type.toUpperCase()})`,

                                html: `
                                    <h2>Reminder Alert</h2>

                                    <p>
                                        <b>Ref Number:</b>
                                        ${reminder.refNumber}
                                    </p>

                                    <p>
                                        <b>Employee:</b>
                                        ${reminder.employee?.name || 'N/A'}
                                    </p>

                                    <p>
                                        <b>Category:</b>
                                        ${reminder.category?.categoryName || 'N/A'}
                                    </p>

                                    <p>
                                        <b>Expiry Date:</b>
                                        ${expiryDate.toDateString()}
                                    </p>

                                    <p>
                                        <b>Days Left:</b>
                                        ${daysLeft}
                                    </p>

                                    <p>
                                        <b>Description:</b>
                                        ${reminder.description || ''}
                                    </p>

                                    <p>
                                        <b>Notes:</b>
                                        ${reminder.notes || ''}
                                    </p>
                                `
                            })
                        }            

                        // SAVE SENT REMINDER HISTORY
                        reminder.sentReminders.push({
                            reminderType: type,
                            daysBefore,
                            sentAt: new Date()
                        })

                        await reminder.save()
                   
                    }
                }
            }

        } catch (error) {

            console.error(
                'Reminder CRON Error:',
                error
            )
        }
    },
    {
        timezone: 'Asia/Kolkata'
    }
)
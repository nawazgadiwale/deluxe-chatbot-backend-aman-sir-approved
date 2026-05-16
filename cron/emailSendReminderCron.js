const cron = require('node-cron')
const Reminder = require('../models/Reminder')
const sendEmail = require('../services/mailService')
// const sendWhatsAppMessage = require('../services/whatsappService')

cron.schedule('0 9 * * *', async () => {
    try {
        console.log('Reminder CRON Started')

        const reminders = await Reminder.find({
            reminderStatus: {
                $nin: ['completed', 'canceled']
            }
        })
            .populate('category')
            .populate('employee')
            .populate('notifyusers')

        const today = new Date()

        for (const reminder of reminders) {
            if (new Date(reminder.expiryDate) < today) {
                reminder.reminderStatus = 'overdue'

                await reminder.save()

                continue
            }

            const expiryDate = new Date(reminder.expiryDate)

            const diffTime =
                expiryDate.getTime() - today.getTime()

            const daysLeft = Math.ceil(
                diffTime / (1000 * 60 * 60 * 24)
            )

            const categoryReminders = reminder.category.reminders

            for (const reminderRule of categoryReminders) {
                const { type, daysBefore } = reminderRule
            }

            if (daysLeft === daysBefore) {
                const alreadySent = reminder.sentReminders.some(
                    sent =>
                        sent.reminderType === type &&
                        sent.daysBefore === daysBefore
                )

                if (alreadySent) {
                    continue
                }

                for (const user of reminder.notifyUsers) {
                    await sendEmail({
                        to: user.email,
                        subject: `${type.toUpperCase()} Reminder - Ref ${reminder.refNumber}`,
                        html:
                            `<h2>Reminder Alert</h2>
                            <p></b>Ref Number:</b> ${reminder.refNumber}</p>
                            <p><b>Employee:</b> ${reminder.employee.name}</p>
                            <p><b>Category:</b> ${reminder.category.categoryName}</p>
                            <p><b>Expiry Date:</b> ${reminder.expiryDate}</p>
                            <p><b>Days Left:</b> ${daysLeft}</p>
                            <p><b>Description:</b> ${reminder.description || ''}</p>
                            <p><b>Notes:</b> ${reminder.notes || ''}</p>
                        `
                    })
                }

                // const whatsappNumbers = [
                //         process.env.WHATSAPP_ADMIN_1,
                //         process.env.WHATSAPP_ADMIN_2
                //     ]

                //     for (const phone of whatsappNumbers) {

                //         await sendWhatsAppMessage({

                //             phone,

                //             message:
                //                 `${type.toUpperCase()} ALERT\n\nRef No: ${reminder.refNumber}\nEmployee: ${reminder.employee.name}\nCategory: ${reminder.category.categoryName}\nExpiry In: ${daysLeft} day(s)`
                //         })
                //     }

                reminder.sentReminders.push({
                    reminderType: type,
                    daysBefore,
                    sentAt: new Date()
                })

                await reminder.save()
            }
        }

        console.log('Reminder cron completed')

    } catch (error) {
        console.error('Reminder Cron Error', error)
    }
})
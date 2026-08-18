const cron = require("node-cron")
const { managerSyncDailyInvoicesOfDDA, managerSyncDailyInvoicesOfStationery } = require("../services/managerServices")
const Data = require("../models/Data")

const syncTodayInvoices = async () => {
    try {
        const [ddaInvoices, stationeryInvoices] = await Promise.all([
            managerSyncDailyInvoicesOfDDA(),
            managerSyncDailyInvoicesOfStationery()
        ])

        const invoices = [...ddaInvoices, ...stationeryInvoices]

        if (invoices.length === 0) {
            return
        }

        const bulkOpertaions = []

        for (const invoice of invoices) {
            const salesQuote = invoice?.salesQuote

            if (!salesQuote) {
                continue
            }

            const quoteNumber = Number(salesQuote);

            if (!Number.isFinite(quoteNumber)) {
                continue
            }

            bulkOpertaions.push({
                updateMany: {
                    filter: {
                        dealStatus: "Quoted",
                        quoteNumber: quoteNumber,
                        products: {
                            $elemMatch: {
                                productName: {
                                    $exists: true,
                                    $nin: ["", "N/A", null]
                                }
                            }
                        }
                    },

                    update: {
                        $set: {
                            dealStatus: "Won",
                            invoiceNumber: Number(
                                invoice.reference
                            ),
                            invoiceDate: invoice.issueDate,
                            assignFollowUp: "Completed"
                        }
                    }
                }
            })
        }

        if (bulkOpertaions.length === 0) {
            return
        }

        const result = await Data.bulkWrite(
            bulkOpertaions,
            {
                ordered: false
            }
        )

    } catch (error) {
        console.error(
            "Manager invoice sync failed:",
            error.response?.data || error.message
        )
    }
}

cron.schedule(
    "0 23 * * *",
    async () => {
        await syncTodayInvoices()
    },
    {
        timezone: "Asia/Kolkata"
    }
)
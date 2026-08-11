const axios = require('axios')

const commonFields = [
    "SalesQuote",
    "IssueDate",
    "Reference",
    "Status"
]

const salesQuoteFields = [
    // "Image",
    // "Attachement",
    "IssueDate",
    // "ExpiryDate",
    "Reference",
    "Customer",
    "Description",
    "Amount",
    "Status",
    "Timestamp"
]

const MANAGER_BASE_URL = process.env.MANAGER_BASE_URL;
const API_KEY = process.env.API_KEY;
const API_KEY_2 = process.env.API_KEY_2

const getTodayDate = () => {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date())
}

const managerSyncDailyInvoicesOfDDA = async () => {
    const queryString = commonFields.map((f) => `fields=${encodeURIComponent(f)}`).join("&")

    const url = `${MANAGER_BASE_URL}/sales-invoices?${queryString}`

    const response = await axios.get(url, {
        headers: {
            Accept: "application/json",
            "X-API-KEY": API_KEY
        }
    })

    const invoices = response.data?.salesInvoices || []

    const today = getTodayDate()

    return invoices.filter(
        invoice => invoice?.issueDate === today
    )
}

const managerSyncDailyInvoicesOfStationery = async () => {
    const queryString = commonFields
        .map((f) => `fields=${encodeURIComponent(f)}`)
        .join("&")

    const url = `${MANAGER_BASE_URL}/sales-invoices?${queryString}`

    const response = await axios.get(url, {
        headers: {
            Accept: "application/json",
            "X-API-KEY": API_KEY_2
        }
    })

    const invoices = response.data?.salesInvoices || []

    const today = getTodayDate()

    return invoices.filter(
        invoice => invoice?.issueDate === today
    )
}

const managerSyncDailyQuotesOfDDA = async (req, res) => {
    const salesQuoteQueryString = salesQuoteFields
        .map((f) => `fields=${encodeURIComponent(f)}`)
        .join("&");

    const url =
        `${MANAGER_BASE_URL}/sales-quotes` +
        `?skip=0&pageSize=200&${salesQuoteQueryString}`;

    const response = await axios.get(url, {
        headers: {
            Accept: "application/json",
            "X-API-KEY": API_KEY
        }
    });

    // IMPORTANT:
    // Direct Manager response already contains salesQuotes array
    const quotes = response.data?.salesQuotes || [];

    const today = getTodayDate();

    return quotes.filter(
        quote => quote?.issueDate === today
    );
};

const managerSyncDailyQuotesStationery = async (req, res) => {
    const salesQuoteQueryString = salesQuoteFields
        .map((f) => `fields=${encodeURIComponent(f)}`)
        .join("&")

    const url =
        `${MANAGER_BASE_URL}/sales-quotes` +
        `?skip=0&pageSize=200&${salesQuoteQueryString}`;

    const response = await axios.get(url, {
        headers: {
            Accept: "application/json",
            "X-API-KEY": API_KEY_2
        }
    })

    const quotes = response.data?.salesQuotes || []

    const today = getTodayDate()

    return quotes.filter(
        quote => quote?.issueDate === today
    )
}

module.exports = {
    managerSyncDailyInvoicesOfDDA, managerSyncDailyInvoicesOfStationery, managerSyncDailyQuotesOfDDA, managerSyncDailyQuotesStationery
}
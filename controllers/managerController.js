const axios = require('axios')

const MANAGER_BASE_URL = process.env.MANAGER_BASE_URL;
const API_KEY = process.env.API_KEY;
const API_KEY_2 = process.env.API_KEY_2

const fields = [
    "IssueDate",
    "Reference",
    "Customer",
    "Description",
    "Amount",
    "Status",
    "Timestamp",
];

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

const commonFields = [
    "SalesQuote",
    "IssueDate",
    "Reference",
    "Status"
]

const salesInvoices = async (req, res) => {
    try {
        const { skip = 0, pageSize = 20, term = "" } = req.query
        const queryString = fields.map(f => `fields=${encodeURIComponent(f)}`).join("&");
        const termParam = term ? `&term=${encodeURIComponent(term)}` : "";

        const url = `${MANAGER_BASE_URL}/sales-invoices?skip=${skip}&pageSize=${pageSize}${termParam}&${queryString}`;

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY,
            },
        });

        return res.json({
            totalRecords: response.data.totalRecords || response.data.length || 0,
            salesInvoices: response.data || [],
        });

    } catch (error) {
        // console.error("Error while fetching digital sales invoices:", error.message)
        console.error("Manager API Error:", error?.response?.data || error.message);
        return { totalRecords: 0, salesInvoices: [] };
    }
};

const stationerySalesInvoices = async (req, res) => {
    try {
        const { skip = 0, pageSize = 20, term = "" } = req.query
        // Build fields query
        const queryString = fields.map((f) => `fields=${encodeURIComponent(f)}`).join("&")

        // add search term if exists
        const termParam = term ? `&term=${encodeURIComponent(term)}` : ""

        const url = `${MANAGER_BASE_URL}/sales-invoices?skip=${skip}&pageSize=${pageSize}${termParam}&${queryString}`

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json({
            totalRecords: response.data.totalRecords || response.data.length || 0,
            salesInvoices: response.data || []
        });
    } catch (error) {
        console.error("Error:", error?.response?.data || error.message);
        return res.status(500).json({ error: "Failed to fetch sales invoices" });
    }
}

const salesIndividualDetails = async (req, res) => {
    try {
        const { id } = req.params
        const url = `${MANAGER_BASE_URL}/sales-invoice-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY
            }
        })

        return res.json(response.data)
    } catch (error) {
        // console.error("Error fetching sales individual invoices:", error.message)
        if (error.response) {
            console.error("Response:", error.response.data)
        }
        return null
    }
}

const stationerySalesIndividualDetails = async (req, res) => {
    try {
        const { id } = req.params
        const url = `${MANAGER_BASE_URL}/sales-invoice-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json(response.data)
    } catch (error) {
        // console.error("Error fetching sales invoices:", error.message)
        if (error.response) {
            console.error("Response:", error.response.data)
        }
        return res.status(500).json({ error: "Failed to fetch sales invoice details" });
    }
}

const getCustomerDetails = async (req, res) => {
    try {
        const { id } = req.params
        const url = `${MANAGER_BASE_URL}/customer-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY
            }
        })

        return res.json(response.data)
    } catch (error) {
        if (error.message) {
            throw error
        } else {
            throw new Error(error.message || 'Unable to get Customer Data')
        }
    }
}

const stationeryGetCustomerDetails = async (req, res) => {
    try {
        const { id } = req.params
        const url = `${MANAGER_BASE_URL}/customer-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json(response.data)
    } catch (error) {
        if (error.message) {
            throw error
        } else {
            throw new Error(error.message || 'Unable to get Customer Data')
        }
    }
}

const getAllQuotes = async (req, res) => {
    try {
        const { skip = 0, pageSize = 20, term = "" } = req.query;

        const salesQuoteQueryString = salesQuoteFields
            .map((f) => `fields=${encodeURIComponent(f)}`)
            .join("&");

        const termParam = term ? `&term=${encodeURIComponent(term)}` : "";

        const url = `${MANAGER_BASE_URL}/sales-quotes?skip=${skip}&pageSize=${pageSize}${termParam}&${salesQuoteQueryString}`;

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY
            }
        });

        return res.json({
            totalRecords: response.data.totalRecords || response.data.length || 0,
            salesQuotes: response.data || []
        });

    } catch (error) {
        console.error("Error:", error?.response?.data || error.message);
        return res.status(500).json({ error: "Failed to fetch sales quotes" });
    }
};

const salesIndividualQuoteDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const url = `${MANAGER_BASE_URL}/sales-quote-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY
            }
        })

        return res.json(response.data)
    } catch (error) {
        // console.error("Error fetching sales individual qoutes:", error.message)
        if (error.message) {
            console.error("Response:", error.response.data)
        }
        return res.status(500).json({ error: "Failed to fetch sales quote details" });
    }
}

const getAllStationeryQuotes = async (req, res) => {
    try {
        const { skip = 0, pageSize = 20, term = "" } = req.query;

        const salesQuoteQueryString = salesQuoteFields.map((f) => `fields=${encodeURIComponent(f)}`).join("&")

        const termParam = term ? `&term=${encodeURIComponent(term)}` : ""
        const url = `${MANAGER_BASE_URL}/sales-quotes?skip=${skip}&pageSize=${pageSize}${termParam}&${salesQuoteQueryString}`

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json({
            totalRecords: response.data.totalRecords || response.data.length || 0,
            salesQuotes: response.data
        })
    } catch (error) {
        // console.error("Error while fetching sales quotes:", error.message)
        if (error.response) {
            console.error("Response:", error.response.data)
        }
        return res.status(500).json({ error: "Failed to fetch stationery sales quotes" })
    }
}

const salesStationeryIndividualDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const url = `${MANAGER_BASE_URL}/sales-quote-form/${id}`
        const response = await axios.get(url, {
            headers: {
                Accept: 'application/json',
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json(response.data)
    } catch (error) {
        // console.error("Error fetching sales individual quotes:", error.message)
        if (error.message) {
            console.error("Response:", error.response.data)
        }
        return res.status(500).json({ error: "Failed to fetch stationery sales quote details" });
    }
}

const ddaIndividualInvoiceInQuote = async (req, res) => {
    try {
        const { term = "" } = req.query;
        const queryString = commonFields.map((f) => `fields=${encodeURIComponent(f)}`).join('&')
        const termParam = term ? `&term=${encodeURIComponent(term)}` : "";
        const url = `${MANAGER_BASE_URL}/sales-invoices?${termParam}&${queryString}`

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY
            }
        })

        return res.json({
            salesInvoices: response.data || []
        })
    } catch (error) {
        if (error.message) {
            console.error("Response:", error.response.data)
        }
        return { salesInvoices: [] }
    }
}

const stationeryIndividualInvoiceInQuote = async (req, res) => {
    try {
        const { term = "" } = req.query;
        const queryString = commonFields.map((f) => `fields=${encodeURIComponent(f)}`).join('&')
        const termParam = term ? `term=${encodeURIComponent(term)}` : ""
        const url = `${MANAGER_BASE_URL}/sales-invoices?${termParam}&${queryString}`

        const response = await axios.get(url, {
            headers: {
                Accept: "application/json",
                "X-API-KEY": API_KEY_2
            }
        })

        return res.json({
            salesInvoices: response.data || []
        })
    } catch (error) {
        if (error.message) {
            console.error("Response:", error.response.data)
        }
        return res.status(500).json({ salesInvoices: [] })
    }
}

module.exports = { salesInvoices, stationerySalesInvoices, salesIndividualDetails, stationerySalesIndividualDetails, getCustomerDetails, stationeryGetCustomerDetails, getAllQuotes, salesIndividualQuoteDetails, getAllStationeryQuotes, salesStationeryIndividualDetails, ddaIndividualInvoiceInQuote, stationeryIndividualInvoiceInQuote };
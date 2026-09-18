// =====================================================
// ENVIRONMENT
// =====================================================

require("dotenv").config();

// =====================================================
// CORE
// =====================================================

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("node:dns");

// =====================================================
// DNS
// =====================================================

if (process.env.FORCE_DNS === "true") {
  dns.setServers(["1.1.1.1", "8.8.8.8"]);
}

// =====================================================
// ROUTES
// =====================================================

const authRoutes = require("./routes/auth");
const jobRoutes = require("./routes/job");
const reportRoutes = require("./routes/report");
const curstomerRoutes = require("./routes/customer");
const managerioRoutes = require("./routes/manager");
const dataRoutes = require("./routes/data");
const reminderRoutes = require("./routes/reminder");
const documentRoutes = require("./routes/document");
const googleRoutes = require("./routes/google");
const leavesRoutes = require("./routes/leave");
const otRoutes = require("./routes/ot");
const supplierRoutes = require("./routes/supplier");

// AI ROUTES
const aiRoutes = require("./routes/ai");

// WHATSAPP WEBHOOK ROUTES
const whatsappRoutes = require("./routes/whatsapp");

// =====================================================
// EXPRESS APP
// =====================================================

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);

// =====================================================
// API ROUTES
// =====================================================

// Auth
app.use("/v1/api/auth", authRoutes);

// Jobs / Orders
app.use("/v1/api/job", jobRoutes);

// Reports
app.use("/v1/api/report", reportRoutes);

// Customer
app.use("/v1/api/customer", curstomerRoutes);

// Manager IO
app.use("/v1/api/managerio", managerioRoutes);

// Data Management
app.use("/v1/api/data", dataRoutes);

// Reminders
app.use("/v1/api/reminder", reminderRoutes);

// Documents
app.use("/v1/api/documents", documentRoutes);

// Google
app.use("/v1/api/google", googleRoutes);

// Leaves
app.use("/v1/api/leaves", leavesRoutes);

// Overtime
app.use("/v1/api/ot", otRoutes);

// Supplier
app.use("/v1/api/supplier", supplierRoutes);

// =====================================================
// AI
// =====================================================

// POST
// /v1/api/ai/chat
//
// GET
// /v1/api/ai/conversation/:sessionId
//
// POST
// /v1/api/ai/conversation/:sessionId/complete

app.use("/v1/api/ai", aiRoutes);

// =====================================================
// WHATSAPP WEBHOOKS
// =====================================================

app.use("/webhooks/whatsapp", whatsappRoutes);
app.use("/webhooks", whatsappRoutes);
app.use("/webhook", whatsappRoutes);

// =====================================================
// STATIC FILES
// =====================================================

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// =====================================================
// CRON JOBS
// =====================================================

require("./cron/expiredReminderCron");

require("./cron/emailSendReminderCron");

require("./cron/managerDailYInvoiceSyncCron");

require("./cron/managerDailyQuotesSyncCron");

require("./cron/leaveCron");

// =====================================================
// DATABASE
// =====================================================

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("MongoDB Connected!");
  })
  .catch((err) => {
    console.log("Failed To Connect DB...");
    console.error(err);
  });

// =====================================================
// SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT} for Deluxe Management`);
  console.log(`[WhatsApp] Meta webhook route: /webhooks/whatsapp`);
});

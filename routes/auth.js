const express = require('express')
const { login, createUser, allUsers, individualUserDetails, editEmployeeDetails, fetchAllEmployees, deleteEmployee, register, verifyOTP, toggleUserDisableStatus, } = require('../controllers/authController')
const { setupAdmin2FA } = require('../controllers/twoFactorController')
const authenticateToken = require('../middlewares/authMiddleware')
const router = express.Router()

// authRoutes
// register route - POST
router.post("/register", register)

// create a new user api
// POST
router.post("/create", authenticateToken, createUser)

// login api
// POST
router.post("/login", login)

// verify otp
// POST
router.post('/verify-otp', verifyOTP)

// setupadmin 2FA
// GET
router.get('/setup-2fa', authenticateToken, setupAdmin2FA)

// get all users 
// GET
router.get("/users", authenticateToken, allUsers)

// get all employees
// GET
router.get("/names/:role", authenticateToken, fetchAllEmployees)

// get individual user details
// GET
router.get("/user/:id", authenticateToken, individualUserDetails)

// update the individual details 
// PUT
router.put("/user/:id", authenticateToken, editEmployeeDetails)

// delete the individual user
// DELETE
router.delete("/user/:id", authenticateToken, deleteEmployee)

// toggle disable of individual user
// POST
router.post("/user/disable/:id", authenticateToken, toggleUserDisableStatus)

module.exports = router
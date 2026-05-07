const express = require('express')
const { login, createUser, allUsers, individualUserDetails, editEmployeeDetails, fetchAllEmployees, deleteEmployee, register, verifyOTP, } = require('../controllers/authController')
const { setupAdmin2FA } = require('../controllers/twoFactorController')
const router = express.Router()

// authRoutes
// register route - POST
router.post("/register", register)

// create a new user api
// POST
router.post("/create", createUser)

// login api
// POST
router.post("/login", login)

// verify otp
// POST
router.post('/verify-otp', verifyOTP)

// setupadmin 2FA
// GET
router.get('/setup-2fa', setupAdmin2FA)

// get all users 
// GET
router.get("/users", allUsers)

// get all employees
// GET
router.get("/names/:role", fetchAllEmployees)

// get individual user details
// GET
router.get("/user/:id", individualUserDetails )

// update the individual details 
// PUT
router.put("/user/:id", editEmployeeDetails)

// delete the individual user
// DELETE
router.delete("/user/:id", deleteEmployee)

module.exports = router
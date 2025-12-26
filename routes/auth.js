const express = require('express')
const { login, createUser, allUsers, individualUserDetails, editEmployeeDetails, fetchAllEmployees, deleteEmployee, } = require('../controllers/authController')
const router = express.Router()

// authRoutes
// register route - POST
// router.post("/register", register)

// create a new user api
// POST
router.post("/create", createUser)

// login api
// POST
router.post("/login", login)

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
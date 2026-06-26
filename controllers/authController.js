const jwt = require('jsonwebtoken')
const User = require('../models/User')
const bcrypt = require('bcrypt')
const speakeasy = require('speakeasy')

// Registration Function
const register = async (req, res) => {
    try {
        // params { body }
        const { name, password, re_password, email, phone, role } = req.body

        // check that user is already exist or not
        const existingUser = await User.findOne({ email })

        // if user already exists
        if (existingUser) return res.status(409).json('User Already exist!')

        // creating a new user
        const newUser = new User({ name, password, re_password, email, phone, role, access: [name] })

        // save new user data
        await newUser.save()

        // generating token
        const token = jwt.sign({ id: newUser._id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' })

        // returning response in json
        res.status(200).json({
            message: 'User Created Successfully!',
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role
            }
        })
    }
    // if something goes wrong
    catch (error) {
        console.log("error", error)
        res.status(500).json('Internal Server Error!')
    }
}


// function to create new user
const createUser = async (req, res) => {
    try {
        // expect params like name, role, password, re_password, email and phone from body
        const { name, lastName, gender, employeeId, role, joiningDate, password, address, departMent, re_password, email, phone } = req.body

        // check if user exists are not
        const existingUser = await User.findOne({ name })

        // if user not existed then return response
        if (existingUser) return res.status(409).json('User Already Exist')

        // if all good create a new user
        const newUser = new User({
            name,
            lastName,
            gender,
            employeeId,
            joiningDate,
                        designation,
            password,
            address,
            departMent,
            re_password,
            email,
            phone,
            role,
            reportingTo,
            workingCountry,
            access: [name],
            createdBy: req.user?._id || null
        })

        // save new user data
        await newUser.save()

        // return success response
        res.status(200).json({
            message: 'User Created Successfully!',
            user: {
                id: newUser._id,
                name: newUser.name,
                lastName: newUser.lastName,
                employeeId: newUser.employeeId,
                gender: newUser.gender,
                joiningDate: newUser.joiningDate,
                address: newUser.address,
                departMent: newUser.departMent,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role,
                access: newUser.access,
                createdBy: newUser.createdBy
            }
        })
    } catch (error) {
        // if error console the response and return the internal server error
        console.log("error", error);

        res.status(500).json('Internal Server Error')
    }
}

// Login Function
// const login = async (req, res) => {
//     // expect email and password from body
//     const { email, password } = req.body

//     try {
//         // find the user upon emailid        
//         const user = await User.findOne({ email })
//         // if not user found return 
//         if (!user) return res.status(404).json('User Not Found!')

//         // check password match or not
//         const isMatch = await user.comparePassword(password)

//         // if password is not matched
//         if (!isMatch) return res.status(404).json('Incorrect Password')

//         // generating token 
//         const token = jwt.sign({ id: user._id, email: user.email, role: user.role, access: user.access }, process.env.JWT_SECRET, { expiresIn: '30d' })

//         // return the success response
//         res.status(200).json({
//             message: `Welcome ${user.name}`,
//             token,
//             user: {
//                 id: user._id,
//                 name: user.name,
//                 email: user.email,
//                 role: user.role,
//                 access: user.access
//             }
//         })
//     } catch (error) {
//         // if error console the response and return the internal server error
//         console.error("error", error)
//         res.status(500).json('Internal Server Error!')
//     }
// }
const login = async (req, res) => {
    const { email, password } = req.body

    try {
        const user = await User.findOne({ email })

        if (!user) {
            return res.status(404).json({ message: "User Not Found!" })
        }

        if (user.disabled) {
            return res.status(403).json({
                success: false,
                message: "Your account has been disabled. Please contact the administrator."
            });
        }

        const isMatch = await user.comparePassword(password)

        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect Password" })
        }

        return res.status(200).json({
            message: `OTP required for ${user.name}`,
            requiresOTP: true,
            userId: user._id
        })
    } catch (error) {
        console.error("error", error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

const verifyOTP = async (req, res) => {
    const { userId, otp } = req.body

    try {
        const user = await User.findById(userId)

        if (!user) {
            return res.status(404).json({ message: "User Not Found!" })
        }

        const verified = speakeasy.totp.verify({
            secret: process.env.ADMIN_2FA_SECRET,
            encoding: 'base32',
            token: otp,
            window: 1
        })

        if (!verified) {
            return res.status(400).json({
                message: "Invalid OTP"
            })
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role,
                access: user.access
            },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        )

        return res.status(200).json({
            message: `Welcome ${user.name}`,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                access: user.access
            }
        })

    } catch (error) {

    }
}

// function to fetch all users
const allUsers = async (req, res) => {
    try {
        let { search, role, page = 1, limit = 10, sort = "newest" } = req.query

        page = Number(page)
        limit = Number(limit)

        let filter = {}

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
            ]
        }

        if (role && role !== "all") {
            filter.role = role
        }

        const skip = (page - 1) * limit

        const sortOption = sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 }
        const users = await User.find(filter)
            .select("-password -re_password")
            .skip(skip)
            .limit(limit)
            .sort(sortOption)

        const filteredCount = await User.countDocuments(filter)

        const totalUsers = await User.countDocuments()

        res.status(200).json({
            success: true,
            message: "Users Data!",
            data: users,
            filteredCount,
            totalUsers,
            currentPage: page,
            totalPages: Math.ceil(filteredCount / limit)
        })
    } catch (error) {
        console.error('Error fetching users:', error.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// individual details function
const individualUserDetails = async (req, res) => {
    try {
        // find user by users id
        const user = await User.findById(req.params.id)

        // if user not found by id
        if (!user) {
            return res.status(404).json('User not found!')
        }

        // return the success response
        res.status(200).json({
            data: user,
            message: "User Details Fetched!"
        })
    } catch (error) {
        // if error console the response and return the internal server error
        console.error("Error fetching individual order:", error)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

// edit employee details function
const editEmployeeDetails = async (req, res) => {
    try {
        // id params 
        const { id } = req.params
        // body parameters
        const { name, lastName, employeeId, gender, joiningDate, designation, address, departMent, email, phone, role, password, re_password, access, reportingTo, workingCountry } = req.body

        // find user by id
        const user = await User.findById(id)

        // if user not found
        if (!user) {
            return res.status(404).json('User not found!')
        }

        // name can't be changed
        if (name && name !== user.name) {
            return res.status(400).json("Name can't be modified")
        }

        // role can't be changed
        if (role && role !== user.role) {
            return res.status(400).json("Role can't be modified")
        }

        // update email
        if (email) user.email = email
        // update phone
        if (phone) user.phone = phone
        // update lastname
        if (lastName) user.lastName = lastName
        // employee id
        if (employeeId) user.employeeId = employeeId
        // gender
        if (gender) user.gender = gender
        // designation
        if (designation) user.designation = designation
        // joiningDate
        if (joiningDate) user.joiningDate = joiningDate
        // adsress
        if (address) user.address = address
        // departMent
        if (departMent) user.departMent = departMent
        // reporting to
        if (reportingTo) user.reportingTo = reportingTo
        // working country
        if (workingCountry) user.workingCountry = workingCountry

        // password
        if (password) {
            // if password and re_password is not matched
            if (password !== re_password) {
                return res.status(400).json({ message: "Password doesn't match" })
            }
            // hash the password
            user.password = password
            // update the re_password
            user.re_password = re_password
        }

        // access modify
        if (access && Array.isArray(access)) {
            // unique access should be ther
            const uniqueAccess = new Set([...access, user.name])
            user.access = Array.from(uniqueAccess)
        }

        // save the change of user
        await user.save()

        // return the success response
        res.status(200).json({
            message: "Employee details updated successfully!",
            id: user._id,
            name: user.name,
            lastName: user.lastName,
            employeeId: user.employeeId,
            gender: user.gender,
            joiningDate: user.joiningDate,
            designation: user.designation,
            address: user.address,
            departMent: user.departMent,
            email: user.email,
            phone: user.phone,
            role: user.role,
            reportingTo: user.reportingTo,
            workingCountry: user.workingCountry,
            access: user.access
        })

    } catch (error) {
        // if error console the response and return the internal server error
        console.error('Error updating employee details!', error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

const deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params

        const user = await User.findById(id)

        if (!user) {
            return res.status(404).json({ message: "User not found!" })
        }

        await User.findByIdAndDelete(id)

        res.status(200).json({
            message: "Employee deleted successfully!",
            deletedId: id
        })
    } catch (error) {
        console.error("Error Deleting the employee!", error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

const fetchAllEmployees = async (req, res) => {
    try {
        // get role as params
        const { role } = req.params;

        // if role not found
        if (!role) {
            return res.status(400).json({ message: 'Role parameter required!' })
        }

        // find the all user with only name and role
        const users = await User.find({ 'role': role }, 'name role')

        // return the success response
        res.status(200).json({
            message: `Employee with role ${role} fetched successfully!`,
            data: users
        })
    } catch (error) {
        // if error console the response and return the internal server error
        console.error('Error fetching employees details!', error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

const toggleUserDisableStatus = async (req, res) => {
    try {
        const { id } = req.params
        const { disabled } = req.body

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        if (user.role === "super-admin") {
            return res.status(400).json({
                success: false,
                message: "Super Admin cannot be disabled"
            })
        }

        if (user.role === "admin") {
            return res.status(400).json({
                success: false,
                message: "Admin cannot be disabled"
            })
        }

        user.disabled = disabled
        await user.save()

        return res.status(200).json({
            success: true,
            message: `User ${disabled ? "disabled" : "enabled"} successfully.`,
            user
        })
    } catch (error) {
        console.error('Error fetching employees details!', error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

const getOrganizationChart = async (req, res) => {
    try {
        const users = await User.find({
            disabled: false,
            designation: { $ne: "N/A" }
        }).select("name lastName designation role email phone workingCountry reportingTo");

        // Company root node
        const nodes = [
            {
                id: "company-root",
                type: "employee",
                data: {
                    name: "Deluxe Digital Advertising",
                    designation: "Organization",
                    isRoot: true
                },
                position: { x: 0, y: 0 }
            }
        ];

        // User lookup by name
        const userMap = {};
        users.forEach(user => {
            userMap[user.name] = user;
        });

        // Employee nodes
        users.forEach(user => {
            nodes.push({
                id: user._id.toString(),
                type: "employee",
                data: {
                    name: `${user.name} ${user.lastName || ""}`.trim(),
                    designation: user.designation,
                    role: user.role,
                    workingCountry: user.workingCountry
                },
                position: { x: 0, y: 0 }
            });
        });

        const edges = [];
        const edgeSet = new Set();

        users.forEach(user => {
            // No manager -> connect to company
            if (!user.reportingTo || user.reportingTo.length === 0) {
                const edgeId = `company-root-${user._id}`;

                if (!edgeSet.has(edgeId)) {
                    edgeSet.add(edgeId);

                    edges.push({
                        id: edgeId,
                        source: "company-root",
                        target: user._id.toString(),
                        type: "smoothstep"
                    });
                }

                return;
            }

            // Multiple reporting managers
            user.reportingTo.forEach(managerName => {
                const manager = userMap[managerName];

                if (!manager) return;

                const edgeId = `${manager._id}-${user._id}`;

                if (!edgeSet.has(edgeId)) {
                    edgeSet.add(edgeId);

                    edges.push({
                        id: edgeId,
                        source: manager._id.toString(),
                        target: user._id.toString(),
                        type: "smoothstep"
                    });
                }
            });
        });

        return res.status(200).json({
            success: true,
            data: {
                nodes,
                edges
            }
        });

    } catch (error) {
        console.error("Error fetching organization chart!", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error!"
        });
    }
};

module.exports = { register, createUser, login, verifyOTP, allUsers, individualUserDetails, editEmployeeDetails, deleteEmployee, fetchAllEmployees, toggleUserDisableStatus, getOrganizationChart }
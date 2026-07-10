const { default: mongoose } = require("mongoose")
const Category = require("../models/Category")
const Reminder = require("../models/Reminder")
const User = require("../models/User")
const { Parser } = require('json2csv')

// Create Category
const createCategory = async (req, res) => {
    try {
        const { createdBy, categoryName, reminders, alertEnabled } = req.body

        if (!categoryName) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            })
        }

        if (!reminders || reminders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one reminder is required'
            })
        }

        const existingCategory = await Category.findOne({
            categoryName
        })

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category already exists'
            })
        }

        const reminderTypes = reminders.map(r => r.type)

        const requiredTypes = [
            'due',
            'moderate',
            'critical'
        ]

        if (reminders.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Minimum 3 reminders are mandatory"
            })
        }

        const hasRequiredTypes = requiredTypes.every(type =>
            reminderTypes.includes(type)
        )

        if (!hasRequiredTypes) {
            return res.status(400).json({
                success: false,
                message: 'Due, moderate and critical reminders are mandatory'
            })
        }

        const lastCategory = await Category.findOne()
            .sort({ catId: -1 })

        let newCatId = 1

        if (lastCategory) {
            newCatId = Number(lastCategory.catId) + 1
        }

        const category = await Category.create({
            createdBy,
            catId: newCatId,
            categoryName,
            reminders,
            alertEnabled
        })

        return res.status(201).json({
            success: true,
            message: "Category Created Successfully!",
            category
        })

    } catch (error) {
        console.error('Error creating category', error.message)
        res.status(500).json({
            message: 'Internal Server Error'
        })
    }
}

// Update Caetgory
const updateCategory = async (req, res) => {
    try {
        const catId = Number(req.params.catId)

        const {
            categoryName,
            reminders,
            alertEnabled
        } = req.body

        const existingCategory = await Category.findOne({ catId })

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category Not found'
            })
        }

        if (!categoryName) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            })
        }

        if (!reminders || reminders.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 3 reminders are mandatory'
            })
        }

        const reminderTypes = reminders.map(r => r.type)

        const requiredTypes = [
            'due',
            'moderate',
            'critical'
        ]

        const hasRequiredTypes = requiredTypes.every(type =>
            reminderTypes.includes(type)
        )

        if (!hasRequiredTypes) {
            return res.status(400).json({
                success: false,
                message: 'Due, moderate and critical reminders are mandatory'
            })
        }

        const duplicateCategory = await Category.findOne({
            categoryName,
            catId: { $ne: catId }
        })

        if (duplicateCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category name already exists'
            })
        }

        const updateCategory = await Category.findOneAndUpdate(
            { catId },
            {
                categoryName,
                reminders,
                alertEnabled
            },
            {
                new: true,
                runValidators: true
            }
        )

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            category: updateCategory
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            succes: false,
            message: 'Internal Server error'
        })
    }
}

// Get Individual Category
const getindividualCategoryData = async (req, res) => {
    try {
        const catId = Number(req.params.catId)

        if (!catId) {
            return res.status(400).json({ message: "Category ID is required" })
        }

        const category = await Category.findOne({ catId }).lean()

        if (!category) {
            return res.status(404).json({ message: "Category Not Found" })
        }

        return res.status(200).json(category)
    } catch (error) {
        console.error("Error fetching individual category", error)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

// Get All Categories
const getAllCategoryList = async (req, res) => {
    try {

        const query = req.query || {}

        const { page = 1, limit = 25, search = "", alertEnabled } = query

        const pipeline = []

        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'createdBy'
            }
        })

        pipeline.push({
            $unwind: {
                path: '$createdBy',
                preserveNullAndEmptyArrays: true
            }
        })

        if (search) {
            if (!isNaN(search)) {
                pipeline.push({
                    $match: {
                        $expr: {
                            $regexMatch: {
                                input: { $toString: "$catId" },
                                regex: search
                            }
                        }
                    }
                })
            } else {
                pipeline.push({
                    $match: {
                        categoryName: {
                            $regex: search,
                            $options: "i"
                        }
                    }
                })
            }
        }

        if (
            alertEnabled === "true" ||
            alertEnabled === "false"
        ) {
            pipeline.push({
                $match: {
                    alertEnabled: alertEnabled === "true"
                }
            })
        }

        pipeline.push({ $sort: { createdAt: 1 } })

        pipeline.push({
            $skip: (parseInt(page) - 1) * parseInt(limit)
        })

        pipeline.push({
            $limit: parseInt(limit)
        })

        const categories = await Category.aggregate(pipeline)

        const countPipelines = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage))
        countPipelines.push({ $count: "total" })

        const countResult = await Category.aggregate(countPipelines)
        const total = countResult.length > 0 ? countResult[0].total : 0

        res.status(200).json({
            success: true,
            message: "Category List!",
            data: categories,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        })

    } catch (error) {
        console.error("Error getting categories", error.message)
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// Delete Category
const deleteCategory = async (req, res) => {
    try {
        const catId = Number(req.params.catId)

        if (!catId) {
            return res.status(400).json({ message: "Category ID is required" })
        }

        const category = await Category.findOne({ catId })

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            })
        }

        const reminderExists = await Reminder.exists({
            category: category._id
        })

        if (reminderExists) {
            return res.status(400).json({
                message: "Cannot delete category, Delete related reminders first."
            })
        }

        await Category.findOneAndDelete({ catId })

        res.status(200).json({
            message: "Category deleted successfully!",
            deletedId: catId
        })

    } catch (error) {
        console.error("Error Deleting the category!", error)
        res.status(500).json({ message: "Internal Server Error!" })
    }
}

// Create Reminder
const createReminder = async (req, res) => {
    try {
        const { createdBy, category, employee, description, expiryDate, notifyUsers, notes, reminderStatus } = req.body

        if (!category) {
            return res.status(400).json({
                success: false,
                message: "Category not found!"
            })
        }

        if (!employee) {
            return res.status(400).json({
                success: false,
                message: "Employee is required"
            })
        }

        if (!expiryDate) {
            return res.status(400).json({
                success: false,
                message: "Expiry date is required"
            })
        }

        if (!notifyUsers || notifyUsers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Notify users are required"
            })
        }

        const allowedStatuses = [
            'active',
            'inprogress',
            'completed',
            'overdue',
            'canceled'
        ]

        if (reminderStatus && !allowedStatuses.includes(reminderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reminder status'
            })
        }

        const existingCategory = await Category.findById(category)

        if (!existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'Category not found'
            })
        }

        const existingEmployee = await User.findById(employee)

        if (!existingEmployee) {
            return res.status(400).json({
                success: false,
                message: 'Employee not found'
            })
        }

        const users = await User.find({
            _id: { $in: notifyUsers }
        })

        if (users.length !== notifyUsers.length) {
            return res.status(400).json({
                success: false,
                message: 'Some notify users are invalid'
            })
        }

        const lastReminder = await Reminder.findOne()
            .sort({ createdAt: -1 })

        let newRefNumber = 1

        if (lastReminder) {
            newRefNumber = Number(lastReminder.refNumber) + 1
        }

        const reminder = await Reminder.create({
            createdBy,
            refNumber: newRefNumber,
            category,
            employee,
            description,
            expiryDate,
            notifyUsers,
            notes,
            reminderStatus: reminderStatus || 'active'
        })

        return res.status(201).json({
            success: true,
            message: 'Reminder created successfully',
            reminder
        })

    } catch (error) {
        console.error('Error creating reminder', error)

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}

// Update Reminder
const updateReminder = async (req, res) => {
    try {
        const refNumber = Number(req.params.refNumber)

        const { category, employee, description, expiryDate, notifyUsers, notes, reminderStatus } = req.body

        const existingReminder = await Reminder.findOne({ refNumber })

        if (!existingReminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found'
            })
        }

        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            })
        }

        if (!employee) {
            return res.status(400).json({
                success: false,
                message: "Employee is required"
            })
        }

        if (!expiryDate) {
            return res.status(400).json({
                success: false,
                message: "Expiry date is required"
            })
        }

        if (!notifyUsers || notifyUsers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Notify users are required'
            })
        }

        const allowedStatuses = [
            'active',
            'inprogress',
            'completed',
            'overdue',
            'canceled'
        ]

        if (reminderStatus && !allowedStatuses.includes(reminderStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reminder status'
            })
        }

        const existingCategory = await Category.findById(category)

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            })
        }

        const existingEmployee = await User.findById(employee)

        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            })
        }

        const users = await User.find({
            _id: { $in: notifyUsers }
        })

        if (users.length !== notifyUsers.length) {
            return res.status(400).json({
                success: false,
                message: 'Some notify users are invalid'
            })
        }

        // check whether old expiry date changed or not
        const oldExpiryDate = new Date(existingReminder.expiryDate)
            .toLocaleDateString('en-CA', {
                timeZone: 'Asia/Dubai'
            })

        const newExpiryDate = new Date(expiryDate)
            .toLocaleDateString("en-CA", {
                timeZone: "Asia/Dubai"
            });

        const expiryDateChanged = oldExpiryDate !== newExpiryDate

        // const updatedReminder = await Reminder.findOneAndUpdate(
        //     { refNumber },
        //     {
        //         category,
        //         employee,
        //         description,
        //         expiryDate,
        //         notifyUsers,
        //         notes,
        //         reminderStatus
        //     },
        //     {
        //         new: true,
        //         runValidators: true
        //     }
        // )

        const updateData = {
            category,
            employee,
            description,
            expiryDate,
            notifyUsers,
            notes,
            reminderStatus
        }

        // Reset sent reminders if expiry date changed
        if (expiryDateChanged) {
            updateData.sentReminders = [];
        }

        const updatedReminder = await Reminder.findOneAndUpdate(
            { refNumber },
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        return res.status(200).json({
            success: true,
            message: expiryDateChanged
                ? "Reminder updated successfully. Reminder history has been reset."
                : "Reminder updated successfully.",
            reminder: updatedReminder
        });

    } catch (error) {
        console.error('Error updating reminder', error)

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}

// Get Individual Reminder
const getIndividualReminder = async (req, res) => {
    try {
        const refNumber = Number(req.params.refNumber)

        if (!refNumber) {
            return res.status(400).json({ message: "Reminder Refnumber is required" })
        }

        const reminder = await Reminder.findOne({ refNumber }).lean()

        if (!reminder) {
            return res.status(404).json({ message: "Reminder Not Found" })
        }

        return res.status(200).json(reminder)
    } catch (error) {
        console.error("Error fetchning individual reminder", error)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

// Get All Reminders
const getAllReminderList = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 25,
            search = "",
            category = "",
            employee = "",
            reminderStatus = "",
            expiryDate = "",
            reminderType = ""
        } = req.query

        const pipeline = []

        // SEARCH FILTER


        // CATEGORY LOOKUP
        pipeline.push({
            $lookup: {
                from: 'categories',
                localField: 'category',
                foreignField: '_id',
                as: 'category'
            }
        })

        pipeline.push({
            $unwind: {
                path: '$category',
                preserveNullAndEmptyArrays: true
            }
        })

        // EMPLOYEE LOOKUP
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'employee',
                foreignField: '_id',
                as: 'employee'
            }
        })

        pipeline.push({
            $unwind: {
                path: '$employee',
                preserveNullAndEmptyArrays: true
            }
        })

        // CATEGORY FILTER
        if (category) {
            pipeline.push({
                $match: {
                    'category.categoryName': category
                }
            })
        }

        // EMPLOYEE FILTER
        if (employee) {
            pipeline.push({
                $match: {
                    'employee.name': employee
                }
            })
        }

        // REMINDER STATUS FILTER
        if (reminderStatus) {
            pipeline.push({
                $match: {
                    reminderStatus
                }
            })
        }

        // EXPIRY DATE FILTER
        if (expiryDate) {

            const startDate = new Date(expiryDate)
            startDate.setHours(0, 0, 0, 0)

            const endDate = new Date(expiryDate)
            endDate.setHours(23, 59, 59, 999)

            pipeline.push({
                $match: {
                    expiryDate: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            })
        }

        // NOTIFY USERS LOOKUP
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'notifyUsers',
                foreignField: '_id',
                as: 'notifyUsers'
            }
        })

        // CREATED BY LOOKUP
        pipeline.push({
            $lookup: {
                from: 'users',
                localField: 'createdBy',
                foreignField: '_id',
                as: 'createdBy'
            }
        })

        pipeline.push({
            $unwind: {
                path: '$createdBy',
                preserveNullAndEmptyArrays: true
            }
        })

        if (search) {
            if (!isNaN(search)) {
                pipeline.push({
                    $match: {
                        $expr: {
                            $regexMatch: {
                                input: {
                                    $toString: "$refNumber"
                                },
                                regex: search
                            }
                        }
                    }
                })
            } else {
                pipeline.push({
                    $match: {
                        $or: [
                            {
                                "category.categoryName": {
                                    $regex: search,
                                    $options: "i"
                                }
                            },

                            // EMPLOYEE NAME SEARCH
                            {
                                "employee.name": {
                                    $regex: search,
                                    $options: "i"
                                }
                            }
                        ]
                    }
                })
            }
        }

        if (reminderType) {
            if (reminderType === "neutral") {
                pipeline.push({
                    $match: {
                        $or: [
                            {
                                sentReminders: {
                                    $exists: false
                                }
                            },
                            {
                                sentReminders: {
                                    $size: 0
                                }
                            }
                        ]
                    }
                })
            } else {
                pipeline.push({
                    $match: {
                        sentReminders: {
                            $elemMatch: {
                                reminderType: reminderType
                            }
                        }
                    }
                })
            }
        }

        // SORTING
        pipeline.push({
            $sort: {
                createdAt: 1
            }
        })

        // PAGINATION
        pipeline.push({
            $skip: (Number(page) - 1) * Number(limit)
        })

        pipeline.push({
            $limit: Number(limit)
        })

        // GET REMINDERS
        const reminders = await Reminder.aggregate(pipeline)

        // COUNT PIPELINE
        const countPipeline = pipeline.filter(stage =>
            !stage.$skip &&
            !stage.$limit &&
            !stage.$sort
        )

        countPipeline.push({
            $count: 'total'
        })

        const countResult = await Reminder.aggregate(countPipeline)

        const total =
            countResult.length > 0
                ? countResult[0].total
                : 0

        return res.status(200).json({
            success: true,
            message: 'Reminders fetched successfully',
            total,
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            reminders
        })

    } catch (error) {

        console.error(
            'Error getting reminders:',
            error.message
        )

        return res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        })
    }
}

// Delete Reminder
const deleteReminder = async (req, res) => {
    try {

        const refNumber = Number(req.params.refNumber)

        if (!refNumber) {
            return res.status(400).json({
                message: "Reminder Reference ID is required"
            })
        }

        const reminder = await Reminder.findOneAndDelete({
            refNumber
        })

        if (!reminder) {
            return res.status(404).json({
                message: "Reminder not found"
            })
        }

        res.status(200).json({
            success: true,
            message: "Reminder deleted successfully!",
            deletedId: refNumber
        })

    } catch (error) {

        console.error(
            "Error Deleting the reminders!",
            error
        )

        res.status(500).json({
            message: "Internal Server Error"
        })
    }
}
// Update Reminder Status
const updateReminderStatus = async (req, res) => {
    try {
        const refNumber = Number(res.params.refNumber)

        const { reminderStatus } = req.body

        const allowedStatuses = [
            'active',
            'inprogress',
            'completed',
            'overdue',
            'canceled'
        ]

        if (!reminderStatus) {
            return res.status(400).json({
                success: false,
                message: 'Reminder status is required'
            })
        }

        if (!allowedStatuses.includes(reminderStatus)) {
            return res.statu(400).json({
                success: false,
                message: 'Invalid reminder status'
            })
        }

        const reminder = await Reminder.findByIdAndUpdate(
            { refNumber },
            {
                reminderStatus
            },
            {
                new: true
            }
        )

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Reminder status updated successfully!',
            reminder
        })
    } catch (error) {
        console.error("Error Updating the reminders status!", error)
        return res.status(500).json({ message: "Internal Server Error" })
    }
}

// Reminder history
const getReminderHistory = async (req, res) => {
    try {
        const refNumber = Number(req.params.refNumber)

        const reminder = await Reminder.findOne({
            refNumber
        })
            .select('refNumber sentReminders')

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found'
            })
        }

        return res.status(200).json({
            success: true,
            refNumber: reminder.refNumber,
            totalHistory: reminder.sentReminders.length,
            history: reminder.sentReminders
        })
    } catch (error) {
        console.error('Error while getting reminder history by refNumber', error)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

// Bulk updates status reminders
const bulkupdateReminderStatus = async (req, res) => {
    try {
        const { refNumbers, reminderStatus } = req.body

        if (!refNumbers || refNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'RefNumbers are required'
            })
        }

        const allowedStatuses = [
            'active',
            'inprogress',
            'completed',
            'overdue',
            'canceled'
        ]

        if (!allowedStatuses.includes(reminder)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reminder status'
            })
        }

        const result = await Reminder.updateMany(
            {
                refNumber: {
                    $in: refNumbers
                }
            },
            {
                $set: {
                    reminderStatus
                }
            }
        )

        return res.status(200).json({
            success: true,
            message: 'Reminder statuses updated successfully',
            modifiedCount: result.modifiedCount
        })
    } catch (error) {
        console.error('Error while updating bulk reminder status')
        return res.status(500).json({ message: 'Internal Server console.error' })
    }
}

// Upcomingexpiry reminders
const upcomingExpiryReminder = async (req, res) => {
    try {
        const days = Number(req.query.days) || 7

        const today = new Date()

        const futureDate = new Date()

        futureDate.setDate(today.getDate() + days)

        const reminders = await Reminder.find({
            expiryDate: {
                $gte: today,
                $lte: futureDate
            }
        })
            .populate('category')
            .populate({
                path: 'employee',
                select: '-password -re_password'
            })

            .populate({
                path: 'notifyUsers',
                select: '-password -re_password'
            })
            .sort({ expiryDate: 1 })

        return res.status(200).json({
            success: true,
            total: reminders.length,
            reminders
        })
    } catch (error) {
        console.error('Error to get upcoming expiry trminder', error)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

// Dashboard Stats
const dashboardStats = async (req, res) => {

    try {

        const today = new Date()

        const next7Days = new Date()
        next7Days.setDate(today.getDate() + 7)

        const next30Days = new Date()
        next30Days.setDate(today.getDate() + 30)

        const next90Days = new Date()
        next90Days.setDate(today.getDate() + 90)

        const next180Days = new Date()
        next180Days.setDate(today.getDate() + 180)

        const [

            totalReminders,

            dueReminders,

            moderateReminders,

            criticalReminders,

            totalCategories,

            alertEnabled,

            alertNotEnabled,

            upcomingWeekExpiryCount,

            upcomingMonthExpiryCount,

            upcoming3MonthExpiryCount,

            upcoming6MonthExpiryCount

        ] = await Promise.all([

            Reminder.countDocuments(),

            Reminder.countDocuments({
                sentReminders: {
                    $elemMatch: {
                        reminderType: 'due'
                    }
                }
            }),

            Reminder.countDocuments({
                sentReminders: {
                    $elemMatch: {
                        reminderType: 'moderate'
                    }
                }
            }),

            Reminder.countDocuments({
                sentReminders: {
                    $elemMatch: {
                        reminderType: 'critical'
                    }
                }
            }),

            Category.countDocuments(),

            Category.countDocuments({
                alertEnabled: true
            }),

            Category.countDocuments({
                alertEnabled: false
            }),

            Reminder.countDocuments({
                expiryDate: {
                    $gte: today,
                    $lte: next7Days
                }
            }),

            Reminder.countDocuments({
                expiryDate: {
                    $gte: today,
                    $lte: next30Days
                }
            }),

            Reminder.countDocuments({
                expiryDate: {
                    $gte: today,
                    $lte: next90Days
                }
            }),

            Reminder.countDocuments({
                expiryDate: {
                    $gte: today,
                    $lte: next180Days
                }
            })
        ])

        return res.status(200).json({

            success: true,

            message:
                'Dashboard stats fetched successfully!',

            data: {

                totalReminders,

                categories: {

                    totalCategories,

                    alertEnabled,

                    alertNotEnabled
                },

                reminderTypes: {

                    due: dueReminders,

                    moderate: moderateReminders,

                    critical: criticalReminders
                },

                expiryStats: {

                    upcomingWeekExpiryCount,

                    upcomingMonthExpiryCount,

                    upcoming3MonthExpiryCount,

                    upcoming6MonthExpiryCount
                }
            }
        })

    } catch (error) {

        console.error(
            'Error fetching dashboard stats',
            error
        )

        return res.status(500).json({

            success: false,

            message: 'Internal Server Error'
        })
    }
}

// Export all reminders
const exportAllReminders = async (req, res) => {
    try {
        const reminders = await Reminder.find()
            .populate('category')
            .populate({
                path: 'employee',
                select: '-password -re_password'
            })
            .populate({
                path: 'notifyUsers',
                select: '-password -re_password'
            })
            .sort({ createdAt: -1 })

        const formatDate = (date) => {
            if (!date) return ""

            return new Date(date)
                .toLocaleDateString('en-GB')
        }

        const formattedData = reminders.map((item) => ({

            'Ref Number':
                item.refNumber || '',

            'Category':
                item.category?.categoryName || '',

            'Employee':
                item.employee?.name || '',

            'Expiry Date':
                formatDate(item.expiryDate),

            'Reminder Status':
                item.reminderStatus || '',

            'Notify Users':
                item.notifyUsers
                    ?.map((user) => user.name)
                    .join(', ') || '',

            'Description':
                item.description || '',

            'Notes':
                item.notes || '',

            'Created At':
                formatDate(item.createdAt)
        }))

        const fields = [

            'Ref Number',

            'Category',

            'Employee',

            'Expiry Date',

            'Reminder Status',

            'Notify Users',

            'Description',

            'Notes',

            'Created At'
        ]

        const json2csvParser = new Parser({ fields })

        const csv = json2csvParser.parse(formattedData)

        res.header(
            'Content-Type',
            'text/csv'
        )

        res.attachment(
            `reminders-${Date.now()}.csv`
        )

        return res.status(200).send(csv)
    } catch (error) {
        console.error('Error exporting all reminders', error)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

const getEmployeeAndCategory = async (req, res) => {
    try {
        const employees = await User.find(
            {},
            { name: 1 }
        ).lean()

        const categories = await Category.find(
            {},
            { categoryName: 1 }
        ).lean()

        return res.status(200).json({
            success: true,
            employees,
            categories
        })

    } catch (error) {
        console.error('Error getting all employee and category list', error)
        return res.status(500).json({ message: 'Internal Server Error' })
    }
}

module.exports = { createCategory, updateCategory, getindividualCategoryData, getAllCategoryList, deleteCategory, createReminder, updateReminder, getIndividualReminder, getAllReminderList, deleteReminder, updateReminderStatus, getReminderHistory, bulkupdateReminderStatus, upcomingExpiryReminder, dashboardStats, exportAllReminders, getEmployeeAndCategory }
const mongoose = require("mongoose")
const Supplier = require("../models/Supplier")
const SupplierDetails = require("../models/SupplierDetails")

const createSupplier = async (req, res) => {
    try {
        const { createdBy, companyName, contactPerson, phoneNumber, emailId, website, address, vatNumber, tradeLicence } = req.body

        const lastSupplier = await Supplier.findOne().sort({ sid: -1 })

        const sid = lastSupplier ? lastSupplier.sid + 1 : 1

        const supplier = await Supplier.create({
            createdBy,
            sid,
            companyName,
            contactPerson,
            phoneNumber,
            emailId,
            website,
            address,
            vatNumber,
            tradeLicence
        })

        return res.status(201).json({
            success: true,
            data: supplier
        })
    } catch (error) {
        console.error("Unable to add the supplier:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to add the supplier",
            error: error.message
        })
    }
}

const getAllSuppliers = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = "" } = req.query

        page = parseInt(page)
        limit = parseInt(limit)

        if (isNaN(page) || page < 1) page = 1
        if (isNaN(limit) || limit < 1) limit = 10

        const skip = (page - 1) * limit

        const filter = {}

        if (search) {
            const isNumber = !isNaN(search)

            filter.$or = [
                { companyName: { $regex: search, $options: "i" } },
                { contactPerson: { $regex: search, $options: "i" } },
                { phoneNumber: { $regex: search, $options: "i" } },
                { emailId: { $regex: search, $options: "i" } }
            ]

            if (isNumber) {
                filter.$or.push({ sid: Number(search) })
            }
        }

        const total = await Supplier.countDocuments(filter)

        const suppliers = await Supplier.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "supplierdetails",
                    localField: "_id",
                    foreignField: "supplier",
                    as: "details"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "createdBy",
                    foreignField: "_id",
                    as: "createdByUser"
                }
            },
            {
                $addFields: {
                    quotedCount: {
                        $size: {
                            $filter: {
                                input: "$details",
                                as: "d",
                                cond: { $ne: ["$$d.quoteNumber", null] }
                            }
                        }
                    },
                    contactedCount: {
                        $size: {
                            $filter: {
                                input: "$details",
                                as: "d",
                                cond: { $ne: ["$$d.contactedDate", null] }
                            }
                        }
                    },
                    lastContactedDate: { $max: "$details.contactedDate" },
                    createdByName: {
                        $ifNull: [{ $arrayElemAt: ["$createdByUser.name", 0] }, null]
                    },
                    divisions: {
                        $setDifference: [
                            {
                                $setUnion: [
                                    {
                                        $map: {
                                            input: "$details",
                                            as: "d",
                                            in: "$$d.division"
                                        }
                                    },
                                    []
                                ]
                            },
                            ["N/A"]
                        ]
                    }
                }
            },
            { $project: { details: 0, createdByUser: 0 } }
        ])

        return res.status(200).json({
            success: true,
            data: suppliers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        })
    } catch (error) {
        console.error("Unable to fetch all suppliers", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch all the suppliers",
            error: error.message
        })
    }
}

const getSupplierDetails = async (req, res) => {
    try {
        let { page = 1, limit = 10, search = '', division, status } = req.query

        page = parseInt(page) || 1
        limit = parseInt(limit) || 10

        const skip = (page - 1) * limit

        const supplier = await Supplier.findById(req.params.supplierId)

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            })
        }

        const filter = {
            supplier: req.params.supplierId
        }

        if (search) {
            filter.$or = [
                { productName: { $regex: search, $options: "i" } }
            ]

            if (!isNaN(search)) {
                filter.$or.push({ rfqNo: Number(search) })
                filter.$or.push({ quoteNumber: Number(search) })
            }
        }

        if (division) {
            filter.division = division
        }

        if (status) {
            filter.status = status
        }

        const [details, total, stats] = await Promise.all([
            SupplierDetails.find(filter)
                .populate('createdBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            SupplierDetails.countDocuments(filter),
            SupplierDetails.aggregate([
                { $match: { supplier: new mongoose.Types.ObjectId(req.params.supplierId) } },
                {
                    $group: {
                        _id: null,
                        contactedCount: {
                            $sum: { $cond: [{ $ne: ["$contactedDate", null] }, 1, 0] }
                        },
                        quotedCount: {
                            $sum: { $cond: [{ $ne: ["$quoteNumber", null] }, 1, 0] }
                        },
                        lastContactedDate: { $max: "$contactedDate" }
                    }
                }
            ])
        ])

        return res.status(200).json({
            success: true,
            supplier,
            details,
            stats: stats[0] || { contactedCount: 0, quotedCount: 0, lastContactedDate: null },
            total,
            page,
            totalPages: Math.ceil(total / limit)
        })

    } catch (error) {
        console.error("Unable to fetch individual supplier ", error)
        return res.status(500).json({
            success: false,
            message: "Failed to fetch individual supplier",
            error: error.message
        })
    }
}

const updateSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByIdAndUpdate(
            req.params.supplierId,
            req.body,
            { new: true, runValidators: true }
        )

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            })
        }

        return res.status(200).json({
            success: true,
            data: supplier
        })
    } catch (error) {
        console.error("Unable to update individual supplier", error)
        return res.status(500).json({
            success: false,
            message: "Failed to update individual supplier",
            error: error.message
        })
    }
}

const deleteSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.supplierId)

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            })
        }

        await SupplierDetails.deleteMany({ supplier: supplier._id })

        await supplier.deleteOne()

        return res.status(200).json({
            success: true,
            message: 'Supplier and related supplier details deleted'
        })
    } catch (error) {
        console.error("Unable to delete individual supplier and its related details", error)
        return res.status(500).json({
            success: false,
            message: "Failed to delete individual supplier and its related details",
            error: error.message
        })
    }
}

const addSupplierDetail = async (req, res) => {
    try {
        const supplier = await Supplier.findById(req.params.supplierId)

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: 'Supplier not found'
            })
        }

        const { createdBy, quoteNumber, contactedDate, division, productName, productSize, description, quantity, unit, unitPrice, totalPrice, status } = req.body

        const lastDetail = await SupplierDetails.findOne().sort({ rfqNo: -1 })
        const rfqNo = lastDetail ? lastDetail.rfqNo + 1 : 1

        const detail = await SupplierDetails.create({
            createdBy,
            supplier: supplier._id,
            rfqNo,
            quoteNumber,
            contactedDate,
            division,
            productName,
            productSize,
            description,
            quantity,
            unit,
            unitPrice,
            totalPrice,
            status
        })

        return res.status(201).json({
            success: true,
            data: detail
        })
    } catch (error) {
        console.error("Unable to add the supplier details:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to add the supplier details",
            error: error.message
        })
    }
}

const updateSupplierDetail = async (req, res) => {
    try {
        const detail = await SupplierDetails.findOneAndUpdate(
            {
                _id: req.params.detailId,
                supplier: req.params.supplierId
            },
            req.body,
            {
                new: true,
                runValidators: true
            }
        )

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: 'Supplier detail not found'
            })
        }

        return res.status(200).json({
            success: true,
            data: detail
        })
    } catch (error) {
        console.error('Unable to update the supplier details:', error)
        return res.status(500).json({
            success: false,
            message: 'Failed to update the supplier details',
            error: error.message
        })
    }
}

const deleteSupplierDetail = async (req, res) => {
    try {
        const detail = await SupplierDetails.findOneAndDelete({
            _id: req.params.detailId,
            supplier: req.params.supplierId
        })

        if (!detail) {
            return res.status(404).json({
                success: false,
                message: 'Supplier detail not found'
            })
        }

        return res.status(200).json({
            success: true,
            message: 'Supplier detail deleted successfully'
        })
    } catch (error) {
        console.error('Unable to delete the supplier details:', error)
        return res.status(500).json({
            success: false,
            message: 'Failed to delete the supplier details',
            error: error.message
        })
    }
}

module.exports = { createSupplier, getAllSuppliers, getSupplierDetails, updateSupplier, deleteSupplier, addSupplierDetail, updateSupplierDetail, deleteSupplierDetail }
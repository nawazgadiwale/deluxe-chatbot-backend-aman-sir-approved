const Folder = require("../models/Folder")
const Document = require("../models/Document")
const { createGoogleDocument, createGoogleFolder, createGoogleSheet, uploadFileToDrive } = require("../services/googleService")
const User = require("../models/User")
const { getDriveClient } = require("../config/google")
const { getDocumentType } = require("../config/documentType")
const axios = require('axios')

// create a new folder in our shared drive folder
const createFolder = async (req, res) => {
    try {
        const { createdBy, folderName, parentFolder, permission } = req.body

        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: "CreatedBy is required!"
            })
        }

        if (!folderName) {
            return res.status(400).json({
                success: false,
                message: "Folder name is required!"
            })
        }

        if (!permission || permission.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Atleast one permission user is required"
            })
        }

        let googleParentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

        // if creating a subfolder (child folder)
        if (parentFolder) {
            const parent = await Folder.findById(parentFolder)

            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: "Parent folder not found!"
                })
            }

            googleParentFolderId = parent.googleFolderId
        }

        const users = await User.find({
            _id: { $in: permission }
        })

        if (users.length !== permission.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users in the permission list do not exist!"
            })
        }

        const lastFolder = await Folder
            .findOne()
            .sort({ folderNo: -1 })

        const folderNo = lastFolder ? lastFolder.folderNo + 1 : 1

        const googleFolder = await createGoogleFolder({
            folderName,
            parentFolderId: googleParentFolderId
        })

        const folder = await Folder.create({
            createdBy,
            folderNo,
            folderName,
            parentFolder: parentFolder || null,
            googleParentFolderId,
            googleFolderId: googleFolder.googleFolderId,
            googleFolderUrl: googleFolder.googleFolderUrl,
            permission
        })

        return res.status(200).json({
            success: true,
            message: "Folder created successfully!",
            folder
        })

    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

// create a new document in our folder
const createDocument = async (req, res) => {
    try {
        const { createdBy, title, type, folder, permission } = req.body

        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: "CreatedBy is required!"
            })
        }

        if (!title || !type || !folder) {
            return res.status(400).json({
                success: false,
                message: "Title, type and folder are required!"
            })
        }

        if (!permission || permission.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Permission people are required"
            })
        }

        if (!["sheet", "document"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document type! Must be either 'sheet' or 'document'."
            })
        }

        const selectedFolder = await Folder.findById(folder)

        if (!selectedFolder) {
            return res.status(400).json({
                success: false,
                message: "Selected folder does not exist!"
            })
        }

        let googleFile
        if (type === "sheet") {
            googleFile = await createGoogleSheet(
                title,
                selectedFolder.googleFolderId
            )
        } else {
            googleFile = await createGoogleDocument(
                title,
                selectedFolder.googleFolderId
            )
        }

        const users = await User.find({
            _id: { $in: permission }
        })

        if (users.length !== permission.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users in the permission list do not exist!"
            })
        }

        const lastDocument = await Document
            .findOne()
            .sort({ documentNo: -1 })

        const documentNo = lastDocument
            ? lastDocument.documentNo + 1
            : 1

        const document = await Document.create({
            createdBy,
            documentNo,
            title,
            type,
            folder,
            googleFileId: googleFile.googleFileId,
            googleUrl: googleFile.googleUrl,
            permission
        })

        return res.status(200).json({
            success: true,
            message: `${type} created successfully!`,
            document
        })
    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const updateFolderPermissions = async (req, res) => {
    try {
        const { id } = req.params
        const { permission } = req.body

        if (!Array.isArray(permission) || permission.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one permission user is required!"
            })
        }

        const folder = await Folder.findById(id)

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found!"
            })
        }

        const users = await User.find({
            _id: { $in: permission }
        }).select("_id")

        if (users.length !== permission.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users in the permission list do not exist!"
            })
        }

        folder.permission = permission

        await folder.save()

        return res.status(200).json({
            success: true,
            message: "Folder permissions updated successfully!",
            folder
        })
    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const updateDocumentPermissions = async (req, res) => {
    try {
        const { id } = req.params
        const { permission } = req.body

        if (!Array.isArray(permission) || permission.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one permission user is required!"
            })
        }

        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found!"
            })
        }

        const users = await User.find({
            _id: { $in: permission }
        }).select("_id")

        if (users.length !== permission.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users do not exists."
            })
        }

        document.permission = permission

        await document.save()

        return res.status(200).json({
            success: true,
            message: "Document permission updated successfully!",
            document
        })

    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const getAllFolders = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", parentFolder } = req.query

        const query = {}

        if (search) {
            query.folderName = {
                $regex: search,
                $options: "i"
            }
        }

        if (parentFolder === "root" || !parentFolder) {
            query.parentFolder = null;
        } else {
            query.parentFolder = parentFolder;
        }

        const total = await Folder.countDocuments(query)

        const folders = await Folder.find(query)
            .populate("createdBy", "name email")
            .populate("parentFolder", "folderName")
            .populate("permission", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))

        return res.status(200).json({
            success: true,
            total,
            folders
        })
    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const getFolderTree = async (req, res) => {
    try {
        const folders = await Folder.find({})
            .select("folderName parentFolder folderNo")
            .populate("parentFolder", "folderName")
            .sort({ folderName: 1 })

        return res.status(200).json({
            success: true,
            total: folders.length,
            folders
        })
    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const getAllDocuments = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = "", type, folder } = req.query

        const query = {}

        if (search) {
            query.title = {
                $regex: search,
                $options: "i"
            }
        }

        if (type) {
            query.type = type
        }

        if (folder) {
            query.folder = folder
        }

        const total = await Document.countDocuments(query)

        const documents = await Document.find(query)
            .populate("createdBy", "name email")
            .populate("folder", "folderName")
            .populate("lastOpenedBy", "name")
            .populate("permission", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))

        return res.status(200).json({
            success: true,
            total,
            documents
        })
    } catch (error) {
        console.error("Internal Server Error:", error)
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        })
    }
}

const getDashboardData = async (req, res) => {
    try {
        const [totalFolders, totalDocuments, totalSheets, totalDocs, totalPdfs, totalImages, totalArchives, otherFiles] = await Promise.all([
            Folder.countDocuments(),
            Document.countDocuments(),
            Document.countDocuments({
                type: "sheet"
            }),
            Document.countDocuments({
                type: "document"
            }),
            Document.countDocuments({
                type: "pdf"
            }),
            Document.countDocuments({
                type: "image"
            }),
            Document.countDocuments({
                type: "archive"
            }),
            Document.countDocuments({
                type: "file"
            })
        ])

        return res.status(200).json({
            success: true,
            overview: {
                totalFolders,
                totalDocuments,
                totalSheets,
                totalDocs,
                totalPdfs,
                totalImages,
                totalArchives,
                otherFiles
            }
        })
    } catch (error) {
        console.error("Internal Server Server", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

// openDocument
const openDocument = async (req, res) => {
    try {
        const { id } = req.params
        const document = await Document.findById(id)

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            })
        }

        const hasPermission =
            document.createdBy.equals(req.user.id) ||
            document.permission.some((user) => {
                const userId = user && user._id ? user._id : user;
                return userId.equals(req.user.id);
            });

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to open this document."
            });
        }

        // Update audit information
        document.lastOpenedBy = req.user.id
        document.lastOpenedAt = new Date()
        document.viewCount += 1

        await document.save()

        const isGoogleDoc = document.type === "document" || document.type === "sheet"

        if (isGoogleDoc) {
            return res.status(200).json({
                success: true,
                isGoogleDoc: true,
                message: "Document updated successfully!",
                url: document.googleUrl
            })
        }

        // FIX 1: Convert standard view links to direct download links for files
        let downloadUrl = document.googleUrl;
        if (downloadUrl.includes('drive.google.com')) {
            const fileIdMatch = downloadUrl.match(/\/d\/([^\/]+)/) || downloadUrl.match(/id=([^&]+)/);
            if (fileIdMatch && fileIdMatch[1]) {
                downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
            }
        }

        // FIX 2: Handle downstream stream errors safely so the backend doesn't crash
        const googleDriveResponse = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream'
        });

        // FIX 3: Fixed missing closing double quote in Content-Disposition string
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.title)}"`);
        res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');

        // FIX 4: Forward stream errors cleanly
        googleDriveResponse.data.on('error', (err) => {
            console.error("Stream pipe error:", err);
            if (!res.headersSent) {
                res.status(500).send("Error streaming the file target.");
            }
        });

        googleDriveResponse.data.pipe(res);
    } catch (error) {
        console.error("Internal Server Server", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

// move folder api
const moveFolder = async (req, res) => {
    try {
        const folderId = req.params.id
        const { destinationFolderId } = req.body

        if (folderId === destinationFolderId) {
            return res.status(400).json({
                success: false,
                message: "Folder cannot be moved into itself."
            })
        }

        const folder = await Folder.findById(folderId)

        if (!folder) {
            return res.status(404).json({
                success: false,
                message: "Folder not found"
            })
        }

        let destinationFolder = null

        if (destinationFolderId) {
            destinationFolder = await Folder.findById(destinationFolderId)

            if (!destinationFolder) {
                return res.status(404).json({
                    success: false,
                    message: "Destination folder not found."
                })
            }

            // prevent moving into child
            let current = destinationFolder

            while (current) {
                if (current._id.toString() === folder._id.toString()) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot move a folder into its own child."
                    })
                }

                if (!current.parentFolder) break

                current = await Folder.findById(current.parentFolder)
            }
        }

        const drive = getDriveClient()

        // Existing google parent
        const oldGoogleParent = folder.googleParentFolderId
            || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

        // new in google parent
        const newGoogleParent = destinationFolder
            ? destinationFolder.googleFolderId
            : process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

        // Move in google drive
        await drive.files.update({
            fileId: folder.googleFolderId,
            addParents: newGoogleParent,
            removeParents: oldGoogleParent,
            supportsAllDrives: true,
            fields: "id, parents"
        })

        // update mongodb
        folder.parentFolder = destinationFolder
            ? destinationFolder._id
            : null

        folder.googleParentFolderId = newGoogleParent

        await folder.save()

        return res.status(200).json({
            success: true,
            message: "Folder moved successfully."
        })
    } catch (error) {
        console.error("Internal Server Server", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

// move document api
const moveDocument = async (req, res) => {
    try {
        const documentId = req.params.id
        const { destinationFolderId } = req.body

        if (!destinationFolderId) {
            return res.status(400).json({
                success: false,
                message: "Destination folder is required!"
            })
        }

        const document = await Document.findById(documentId)

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found"
            })
        }

        if (document.folder.toString() === destinationFolderId) {
            return res.status(400).json({
                success: false,
                message: "Document is already in this folder."
            })
        }

        const destinationFolder = await Folder.findById(destinationFolderId)

        if (!destinationFolder) {
            return res.status(404).json({
                success: false,
                message: "Destination folder not found."
            })
        }

        const currentFolder = await Folder.findById(document.folder)

        const oldGoogleParent = currentFolder
            ? currentFolder.googleFolderId
            : process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

        const newGoogleParent = destinationFolder.googleFolderId

        const drive = getDriveClient()

        // Move file in google drive
        await drive.files.update({
            fileId: document.googleFileId,
            addParents: newGoogleParent,
            removeParents: oldGoogleParent,
            supportsAllDrives: true,
            fields: "id, parents"
        })

        // update mongodb
        document.folder = destinationFolder._id

        await document.save()

        return res.status(200).json({
            success: true,
            message: "Document moved successfully."
        })
    } catch (error) {
        console.error("Internal Server Server", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const uploadDocument = async (req, res) => {
    try {
        const { createdBy, folder, permission } = req.body

        if (!createdBy) {
            return res.status(400).json({
                success: false,
                message: "CreatedBy is required!"
            })
        }

        if (!folder) {
            return res.status(400).json({
                success: false,
                message: "Folder is required!"
            })
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Atleast one file os required!"
            })
        }

        if (!permission || permission.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Permission people are required"
            })
        }

        const selectedFolder = await Folder.findById(folder)

        if (!selectedFolder) {
            return res.status(400).json({
                success: false,
                message: "Selected folder does not exist!"
            })
        }

        const users = await User.find({
            _id: { $in: permission }
        })

        if (users.length !== permission.length) {
            return res.status(400).json({
                success: false,
                message: "One or more users in the permision list do not exist!"
            })
        }

        const lastDocument = await Document
            .findOne()
            .sort({ documentNo: -1 })


        let nextDocumentNo = lastDocument ? lastDocument.documentNo + 1 : 1

        // Upload every file to Drive in parallel
        const uploadFiles = await Promise.all(
            req.files.map((file) =>
                uploadFileToDrive({
                    fileBuffer: file.buffer,
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    parentFolderId: selectedFolder.googleFolderId
                }).then((googleFile) => ({ file, googleFile }))
            )
        )

        // ...then create the Document records sequentially so each one gets
        // a strictly increasing, unique documentNo

        const documents = []

        for (const { file, googleFile } of uploadFiles) {
            const calculatedType = getDocumentType(file.mimetype)
            const document = await Document.create({
                createdBy,
                documentNo: nextDocumentNo,
                title: file.originalname,
                type: calculatedType,
                folder,
                googleFileId: googleFile.googleFileId,
                googleUrl: googleFile.googleUrl,
                permission,
            });

            documents.push(document);
            nextDocumentNo++;
        }

        return res.status(200).json({
            success: true,
            message: `${documents.length} file${documents.length > 1 ? "s" : ""} uploaded successfully!`,
            documents
        })

    } catch (error) {
        console.error("Internal Server Server", error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

module.exports = { createFolder, createDocument, updateFolderPermissions, updateDocumentPermissions, getAllFolders, getFolderTree, getAllDocuments, getDashboardData, openDocument, moveFolder, moveDocument, uploadDocument }

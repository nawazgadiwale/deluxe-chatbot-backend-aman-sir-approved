
// Shared Drive folder ID that the service account has access to

const { getDriveClient } = require("../config/google")

// So we can restrict to only folder
const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID

const createError = (message, statusCode = 500) => {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
}

// Create a new folder in our shared drive folder
const createGoogleFolder = async ({ folderName, parentFolderId = PARENT_FOLDER_ID }) => {
    try {
        const drive = getDriveClient()

        const { data } = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                ...(parentFolderId && {
                    parents: [parentFolderId]
                })
            },
            fields: 'id,name,webViewLink',
            supportsAllDrives: true
        })

        await drive.permissions.create({
            fileId: data.id,
            requestBody: {
                role: "writer",
                type: "anyone"
            }
        })

        if (!data.id) {
            throw createError("Failed to create Google file.")
        }

        return {
            googleFolderId: data.id,
            googleFolderUrl: data.webViewLink,
            folderName: data.name,
            googleParentFolderId: parentFolderId
        }
    } catch (error) {
        console.error("Google File Create Error:", error)
        throw createError(
            error.message || "Failed to create Google file",
            error.statusCode || 500
        )
    }
}

// Service function to create a Google Sheet in the specified shared drive folder
const createGoogleSheet = async (title, parentFolderID = PARENT_FOLDER_ID) => {
    try {
        const drive = getDriveClient()

        const { data } = await drive.files.create({
            requestBody: {
                name: title,
                mimeType: "application/vnd.google-apps.spreadsheet",
                ...(parentFolderID && {
                    parents: [parentFolderID]
                })
            },
            fields: "id,name,webViewLink",
            supportsAllDrives: true
        })

        await drive.permissions.create({
            fileId: data.id,
            requestBody: {
                role: "writer",
                type: "anyone"
            }
        })

        if (!data.id) {
            throw createError("Unable to create Google Sheet.")
        }

        return {
            googleFileId: data.id,
            googleUrl: data.webViewLink,
            title: data.name,
        }

    } catch (error) {
        console.error("Create Google Sheet Error:", error)

        throw createError(
            error.message || "Failed to create Google Sheet.",
            error.statusCode || 500
        )
    }
}

// Service function to create a Google Doc in the specified shared drive folder
const createGoogleDocument = async (title, parentFolderId = PARENT_FOLDER_ID) => {
    try {
        const drive = getDriveClient()

        const { data } = await drive.files.create({
            requestBody: {
                name: title,
                mimeType: "application/vnd.google-apps.document",
                ...(parentFolderId && {
                    parents: [parentFolderId]
                })
            },
            fields: 'id,name,webViewLink'
        })

        await drive.permissions.create({
            fileId: data.id,
            requestBody: {
                role: "writer",
                type: "anyone"
            }
        })

        if (!data.id) {
            throw createError("Unable to create Google Document.")
        }

        return {
            googleFileId: data.id,
            googleUrl: data.webViewLink,
            title: data.name,
        }
    } catch (error) {
        console.error("Create Google Document Error:", error)

        throw createError(
            error.message || "Failed to create Google Document.",
            error.statusCode || 500
        )
    }
}

module.exports = { createGoogleFolder, createGoogleSheet, createGoogleDocument }
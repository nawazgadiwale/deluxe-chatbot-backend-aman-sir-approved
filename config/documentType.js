export const getDocumentType = (mimeType) => {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType.startsWith("image/")) return "image";

    // Spreadsheets (CSV, Excel)
    if (
        mimeType === "text/csv" ||
        mimeType === "application/vnd.ms-excel" ||
        mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
        return "sheet";
    }

    // Text Documents (Word, Plain Text)
    if (
        mimeType === "text/plain" ||
        mimeType === "application/msword" ||
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return "document";
    }

    // Archives (Zip)
    if (mimeType === "application/zip") return "archive";

    return "file"; // Fallback standard
}
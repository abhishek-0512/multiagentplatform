import fs from "fs"
import path from "path"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import * as xlsx from "xlsx"

/**
 * Extracts structured text and metadata from uploaded files (PDF, DOCX, DOC, XLSX, XLS, CSV, TXT, MD, JSON).
 * @param {Object} file - Multer file object ({ path, originalname, mimetype, size })
 * @returns {Promise<{ text: string, metadata: Object }>}
 */
export const parseFileContent = async (file) => {
    if (!file || !file.path) {
        throw new Error("No file provided for parsing")
    }

    const ext = path.extname(file.originalname || "").toLowerCase()
    const mime = file.mimetype || ""
    console.log(`[FILE] Upload request received: ${file.originalname} (MIME: ${mime || "unknown"}, Size: ${file.size} bytes)`)

    const buffer = fs.readFileSync(file.path)
    let extractedText = ""
    let fileType = "Text / Source Document"

    // 1. PDF
    if (ext === ".pdf" || mime === "application/pdf") {
        fileType = "PDF Document"
        const pdfData = await pdfParse(buffer)
        extractedText = pdfData.text || ""
    }
    // 2. Word (DOCX / DOC)
    else if (ext === ".docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        fileType = "Word Document (.docx)"
        const docResult = await mammoth.extractRawText({ buffer })
        extractedText = docResult.value || ""
    }
    else if (ext === ".doc" || mime === "application/msword") {
        fileType = "Word Document (.doc)"
        try {
            const docResult = await mammoth.extractRawText({ buffer })
            extractedText = docResult.value || ""
        } catch {
            // Fallback for older binary .doc format
            extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim()
        }
    }
    // 3. Excel (XLSX / XLS)
    else if (ext === ".xlsx" || ext === ".xls" || mime.includes("spreadsheet") || mime.includes("excel")) {
        fileType = "Excel Spreadsheet"
        const workbook = xlsx.read(buffer, { type: "buffer" })
        const sheetSummaries = []

        workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName]
            const csvContent = xlsx.utils.sheet_to_csv(sheet)
            const jsonRows = xlsx.utils.sheet_to_json(sheet)

            sheetSummaries.push(
                `### Sheet: "${sheetName}" (${jsonRows.length} rows)\n` +
                `CSV Representation:\n\`\`\`csv\n${csvContent}\n\`\`\`\n`
            )
        })

        extractedText = sheetSummaries.join("\n\n")
    }
    // 4. CSV
    else if (ext === ".csv" || mime === "text/csv") {
        fileType = "CSV Data Table"
        const rawCsv = buffer.toString("utf-8")
        try {
            const workbook = xlsx.read(buffer, { type: "buffer" })
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonRows = xlsx.utils.sheet_to_json(firstSheet)
            extractedText = `### CSV Data Summary (${jsonRows.length} rows):\n\`\`\`csv\n${rawCsv}\n\`\`\``
        } catch {
            extractedText = rawCsv
        }
    }
    // 5. Plain Text / Markdown / JSON / Code
    else {
        fileType = "Text / Source Document"
        extractedText = buffer.toString("utf-8")
    }

    // Clean up excessive whitespace
    const cleanedText = extractedText
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()

    if (!cleanedText || cleanedText.length === 0) {
        throw new Error(`No readable text could be extracted from file: ${file.originalname}`)
    }

    console.log(`[FILE] Extracted characters: ${cleanedText.length} from ${file.originalname} (${fileType})`)

    return {
        text: cleanedText,
        metadata: {
            filename: file.originalname,
            fileType,
            sizeBytes: file.size,
            charCount: cleanedText.length,
            pageCountEstimate: Math.max(1, Math.ceil(cleanedText.length / 2500))
        }
    }
}

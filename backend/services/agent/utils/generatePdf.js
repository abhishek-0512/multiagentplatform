import PDFDocument from "pdfkit"

export const generatePdf = async (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margin: 45,
                bufferPages: true,
                info: {
                    Author: "Nexora Platform",
                    Title: data.title || "Document",
                    Subject: data.subtitle || data.title || "Report",
                    Creator: "Nexora"
                }
            })

            const chunks = []
            doc.on("data", (chunk) => chunks.push(chunk))
            doc.on("end", () => {
                const totalPages = doc.bufferedPageRange().count
                for (let i = 0; i < totalPages; i++) {
                    doc.switchToPage(i)
                    // Bottom Page Footer
                    doc
                        .fontSize(8)
                        .fillColor("#94A3B8")
                        .text(
                            `Nexora Platform  •  Page ${i + 1} of ${totalPages}`,
                            45,
                            doc.page.height - 35,
                            { align: "center", width: doc.page.width - 90 }
                        )
                }
                resolve(Buffer.concat(chunks))
            })
            doc.on("error", (err) => reject(err))

            const pageWidth = doc.page.width - 90 // 505 pt content width

            // 1. Header Banner & Title
            doc.rect(45, 40, pageWidth, 4).fill("#2563EB") // Primary accent line
            doc.moveDown(1.5)

            // Document Category Tag
            doc
                .fontSize(9)
                .font("Helvetica-Bold")
                .fillColor("#2563EB")
                .text(data.category ? data.category.toUpperCase() : "TECHNICAL REPORT & DOCUMENTATION", {
                    tracking: 1.2
                })
            doc.moveDown(0.3)

            // Document Title
            doc
                .fontSize(22)
                .font("Helvetica-Bold")
                .fillColor("#0F172A")
                .text(data.title || "Technical Document", {
                    width: pageWidth,
                    lineGap: 2
                })

            // Subtitle
            if (data.subtitle) {
                doc.moveDown(0.3)
                doc
                    .fontSize(11)
                    .font("Helvetica")
                    .fillColor("#64748B")
                    .text(data.subtitle, {
                        width: pageWidth,
                        lineGap: 2
                    })
            }

            // Meta Info Bar
            doc.moveDown(0.6)
            doc
                .fontSize(8.5)
                .font("Helvetica")
                .fillColor("#94A3B8")
                .text(`Author: Nexora Platform  |  Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}  |  Classification: Official`, {
                    width: pageWidth
                })

            doc.moveDown(0.8)
            doc.strokeColor("#E2E8F0").lineWidth(0.8).moveTo(45, doc.y).lineTo(45 + pageWidth, doc.y).stroke()
            doc.moveDown(1.0)

            // 2. Executive Summary Callout Box
            if (data.summary || data.executiveSummary) {
                const summaryText = data.summary || data.executiveSummary
                const boxTop = doc.y
                const boxPadding = 12

                // Estimate height
                doc.fontSize(9.5).font("Helvetica")
                const textHeight = doc.heightOfString(summaryText, { width: pageWidth - (boxPadding * 2) - 8 })
                const totalBoxHeight = textHeight + 28

                // Draw background box
                doc.rect(45, boxTop, pageWidth, totalBoxHeight).fill("#F8FAFC")
                // Left accent border
                doc.rect(45, boxTop, 4, totalBoxHeight).fill("#3B82F6")

                // Box Title
                doc.fillColor("#1E3A8A").font("Helvetica-Bold").fontSize(10)
                doc.text("EXECUTIVE SUMMARY", 45 + boxPadding + 4, boxTop + 8)

                // Box Body
                doc.fillColor("#334155").font("Helvetica").fontSize(9.5)
                doc.text(summaryText, 45 + boxPadding + 4, boxTop + 22, {
                    width: pageWidth - (boxPadding * 2) - 8,
                    lineGap: 3
                })

                doc.y = boxTop + totalBoxHeight + 14
            }

            // 3. Document Sections
            const sections = data.sections || []
            sections.forEach((section, sIdx) => {
                // Ensure page break doesn't orphan heading
                if (doc.y > doc.page.height - 120) {
                    doc.addPage()
                }

                // Section Number + Heading
                doc
                    .fontSize(13)
                    .font("Helvetica-Bold")
                    .fillColor("#0F172A")
                    .text(`${sIdx + 1}.0  ${section.heading || "Section"}`, {
                        lineGap: 3
                    })

                doc.moveDown(0.3)

                // Section Narrative / Paragraph if present
                if (section.paragraph || section.description) {
                    doc
                        .fontSize(9.5)
                        .font("Helvetica")
                        .fillColor("#334155")
                        .text(section.paragraph || section.description, {
                            width: pageWidth,
                            lineGap: 3
                        })
                    doc.moveDown(0.5)
                }

                // Section Bullet Points
                if (section.points && Array.isArray(section.points)) {
                    section.points.forEach((point) => {
                        if (doc.y > doc.page.height - 70) doc.addPage()

                        const bulletY = doc.y
                        // Draw clean bullet circle
                        doc.circle(52, bulletY + 5, 2.2).fill("#3B82F6")

                        doc
                            .fontSize(9.5)
                            .font("Helvetica")
                            .fillColor("#334155")
                            .text(point, 62, bulletY, {
                                width: pageWidth - 20,
                                lineGap: 2.5
                            })
                        doc.moveDown(0.35)
                    })
                }

                doc.moveDown(0.8)
            })

            // 4. Comparison Table (if provided)
            if (data.table && data.table.headers && data.table.rows) {
                if (doc.y > doc.page.height - 180) doc.addPage()

                doc
                    .fontSize(12)
                    .font("Helvetica-Bold")
                    .fillColor("#0F172A")
                    .text(data.table.title || "Comparative Matrix & Specifications")
                doc.moveDown(0.4)

                const headers = data.table.headers || []
                const rows = data.table.rows || []
                const colCount = Math.max(headers.length, 1)
                const colWidth = pageWidth / colCount
                const startX = 45
                let currentY = doc.y

                // Header Row
                doc.rect(startX, currentY, pageWidth, 22).fill("#1E293B")
                headers.forEach((h, hIdx) => {
                    doc
                        .fontSize(9)
                        .font("Helvetica-Bold")
                        .fillColor("#FFFFFF")
                        .text(h, startX + (hIdx * colWidth) + 6, currentY + 6, {
                            width: colWidth - 12,
                            align: "left"
                        })
                })
                currentY += 22

                // Table Rows
                rows.forEach((row, rIdx) => {
                    if (currentY > doc.page.height - 60) {
                        doc.addPage()
                        currentY = 45
                    }

                    const rowBg = rIdx % 2 === 0 ? "#F8FAFC" : "#FFFFFF"
                    doc.rect(startX, currentY, pageWidth, 20).fill(rowBg)
                    doc.strokeColor("#E2E8F0").lineWidth(0.5).rect(startX, currentY, pageWidth, 20).stroke()

                    const cells = Array.isArray(row) ? row : Object.values(row)
                    cells.forEach((cell, cIdx) => {
                        doc
                            .fontSize(8.5)
                            .font("Helvetica")
                            .fillColor("#334155")
                            .text(String(cell), startX + (cIdx * colWidth) + 6, currentY + 5, {
                                width: colWidth - 12,
                                align: "left"
                            })
                    })
                    currentY += 20
                })

                doc.y = currentY + 15
            }

            // 5. Key Recommendations / Action Items Box
            if (data.recommendations && data.recommendations.length > 0) {
                if (doc.y > doc.page.height - 150) doc.addPage()

                const recBoxTop = doc.y
                doc.rect(45, recBoxTop, pageWidth, 4).fill("#10B981")
                doc.moveDown(0.5)

                doc
                    .fontSize(11)
                    .font("Helvetica-Bold")
                    .fillColor("#065F46")
                    .text("KEY ACTIONABLE RECOMMENDATIONS")
                doc.moveDown(0.3)

                data.recommendations.forEach((rec, idx) => {
                    if (doc.y > doc.page.height - 60) doc.addPage()
                    doc
                        .fontSize(9)
                        .font("Helvetica")
                        .fillColor("#1F2937")
                        .text(`${idx + 1}.  ${rec}`, 52, doc.y, {
                            width: pageWidth - 10,
                            lineGap: 2.5
                        })
                    doc.moveDown(0.25)
                })
            }

            doc.end()
        } catch (err) {
            reject(err)
        }
    })
}
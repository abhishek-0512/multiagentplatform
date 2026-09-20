import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { AnimatePresence, easeInOut, motion } from "motion/react"
import Editor from '@monaco-editor/react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  Layers,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Presentation,
  Sparkles,
  TrendingUp,
  Columns,
  Cpu,
  GitCommit,
  X
} from 'lucide-react'

function Artifact() {
  const [collapsed, setCollapsed] = useState(false)
  const { artifacts } = useSelector(state => state.message)
  const [tab, setTab] = useState("code")
  const [pdfViewMode, setPdfViewMode] = useState("document") // "document" | "raw"
  const [activeFile, setActiveFile] = useState(0)
  const [activeSlide, setActiveSlide] = useState(0)
  const [copied, setCopied] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const artifact = artifacts?.[0]
  const type = artifact?.type || (artifact?.files?.length ? "Project" : "")

  useEffect(() => {
    setActiveFile(0)
    setActiveSlide(0)
    if (type === "Presentation") {
      setTab("presentation")
    } else if (type === "PDF") {
      setTab("pdf")
    } else {
      setTab("code")
    }
  }, [artifact, type])

  if (!artifact) return null

  // Code artifact properties
  const file = artifact?.files?.[activeFile]
  const htmlFile = artifact?.files?.find(f => f.name === "index.html")
  const cssFile = artifact?.files?.find(f => f.name === "style.css")
  const jsFile = artifact?.files?.find(f => f.name === "script.js")
  const canPreview = Boolean(htmlFile)

  const buildPreviewDoc = () => {
    const rawHtml = htmlFile?.content || ""
    const rawCss = cssFile?.content || ""
    const rawJs = jsFile?.content || ""

    if (rawHtml.toLowerCase().includes("<html") || rawHtml.toLowerCase().includes("<!doctype")) {
      let doc = rawHtml
      if (rawCss && !doc.includes(rawCss)) {
        if (doc.includes("</head>")) {
          doc = doc.replace("</head>", `<style>\n${rawCss}\n</style></head>`)
        } else {
          doc = `<style>\n${rawCss}\n</style>` + doc
        }
      }
      if (rawJs && !doc.includes(rawJs)) {
        if (doc.includes("</body>")) {
          doc = doc.replace("</body>", `<script>\n${rawJs}\n</script></body>`)
        } else {
          doc = doc + `<script>\n${rawJs}\n</script>`
        }
      }
      return doc
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
     ${rawCss}
    </style>
</head>
<body>
 ${rawHtml} 
<script>
    ${rawJs}
</script>    
</body>
</html>`
  }

  const previewDoc = buildPreviewDoc()

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text || file?.content || "")
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const detectLanguage = (fileName = "") => {
    const name = fileName.toLowerCase()
    if (name.endsWith(".html")) return "html"
    if (name.endsWith(".css")) return "css"
    if (name.endsWith(".js") || name.endsWith(".jsx")) return "javascript"
    if (name.endsWith(".ts") || name.endsWith(".tsx")) return "typescript"
    if (name.endsWith(".json")) return "json"
    if (name.endsWith(".py")) return "python"
    if (name.endsWith(".java")) return "java"
    if (name.endsWith(".cpp") || name.endsWith(".c")) return "cpp"
    return "plaintext"
  }

  const handleDownloadActiveFile = () => {
    if (!file?.content) return
    const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name || "code.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ==================== PRESENTATION RENDERER ====================
  const renderPresentation = (inFullscreen = false) => {
    const slides = artifact?.slides || []
    const totalSlides = slides.length
    const currentSlide = slides[activeSlide] || slides[0]

    if (!currentSlide) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6 text-center">
          <Presentation size={36} className="text-slate-300 mb-2" />
          <p className="text-sm">No slides available to preview.</p>
        </div>
      )
    }

    const slideType = currentSlide.type || (
      currentSlide.comparison || (currentSlide.leftTitle && currentSlide.rightTitle) ? "comparison" :
      currentSlide.steps ? "process" :
      currentSlide.metrics ? "stats" :
      currentSlide.components ? "architecture" : "concept"
    )

    return (
      <div className="flex flex-col h-full bg-slate-100/80 overflow-hidden select-none">
        {/* Active Slide Canvas */}
        <div className="flex-1 p-3 md:p-6 flex flex-col justify-center items-center overflow-y-auto">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full max-w-[760px] aspect-[16/10] bg-white border border-slate-200/90 rounded-2xl p-5 md:p-7 shadow-lg flex flex-col justify-between relative overflow-hidden"
          >
            {/* Slide Top Bar */}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={12} /> {currentSlide.tagline || `Slide ${activeSlide + 1} of ${totalSlides}`}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {artifact.title || "Presentation"}
                </span>
              </div>
              <h2 className="text-base md:text-lg font-bold text-slate-900 leading-snug tracking-tight">
                {currentSlide.title}
              </h2>
            </div>

            {/* Dynamic Slide Body by Type */}
            <div className="relative z-10 my-auto py-2 overflow-y-auto max-h-[65%] [scrollbar-width:none]">
              {/* 1. COMPARISON SLIDE */}
              {slideType === "comparison" && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
                    <div className="text-[11px] font-bold text-blue-800 mb-2 pb-1 border-b border-blue-200">
                      {currentSlide.comparison?.leftTitle || currentSlide.leftTitle || "Baseline"}
                    </div>
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentSlide.comparison?.leftPoints || currentSlide.leftPoints || []).map((pt, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-blue-600 shrink-0">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
                    <div className="text-[11px] font-bold text-emerald-800 mb-2 pb-1 border-b border-emerald-200">
                      {currentSlide.comparison?.rightTitle || currentSlide.rightTitle || "Optimized"}
                    </div>
                    <ul className="space-y-1.5 text-slate-700">
                      {(currentSlide.comparison?.rightPoints || currentSlide.rightPoints || []).map((pt, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 shrink-0 font-bold">✓</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* 2. PROCESS / WORKFLOW SLIDE */}
              {slideType === "process" && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {(currentSlide.steps || []).map((st, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col items-center text-center">
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center mb-1.5">
                        {st.step || i + 1}
                      </div>
                      <div className="font-semibold text-slate-800 text-[11px] mb-1 leading-tight">{st.title}</div>
                      <div className="text-[10px] text-slate-500 leading-tight">{st.description || st.text}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 3. METRICS / STATS SLIDE */}
              {slideType === "stats" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    {(currentSlide.metrics || []).map((m, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-xl md:text-2xl font-black text-indigo-600">
                          {m.value}
                        </div>
                        <div className="text-[10px] md:text-[11px] text-slate-600 font-medium mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {(currentSlide.summary || currentSlide.points?.length) && (
                    <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2 leading-relaxed">
                      {currentSlide.summary || currentSlide.points?.join(" • ")}
                    </p>
                  )}
                </div>
              )}

              {/* 4. ARCHITECTURE SLIDE */}
              {slideType === "architecture" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {(currentSlide.components || []).map((c, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                        <div className="text-[11px] font-bold text-indigo-700 mb-1">{c.name}</div>
                        <div className="text-[10px] text-slate-500 leading-tight">{c.role || c.description}</div>
                      </div>
                    ))}
                  </div>
                  {currentSlide.flowSummary && (
                    <div className="text-[10px] text-indigo-800 italic bg-indigo-50 border border-indigo-200 rounded-lg p-1.5 text-center">
                      Flow: {currentSlide.flowSummary}
                    </div>
                  )}
                </div>
              )}

              {/* 5. CONCEPT / DEFAULT BULLET SLIDE */}
              {(slideType === "concept" || (!currentSlide.comparison && !currentSlide.steps && !currentSlide.metrics && !currentSlide.components)) && (
                <div className="space-y-2">
                  <ul className="space-y-2">
                    {(currentSlide.points || []).map((point, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-start gap-2.5 text-xs md:text-sm text-slate-700 leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                        <span>{point}</span>
                      </motion.li>
                    ))}
                  </ul>
                  {currentSlide.keyTakeaway && (
                    <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <Sparkles size={12} className="shrink-0 text-amber-600" />
                      <span>{currentSlide.keyTakeaway}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Slide Footer */}
            <div className="relative z-10 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
              <span className="truncate max-w-[280px]">{artifact.subtitle || "AI Generated Slide Deck"}</span>
              <span className="font-semibold text-slate-500">{activeSlide + 1} / {totalSlides}</span>
            </div>
          </motion.div>
        </div>

        {/* Slide Controls & Thumbnails */}
        <div className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                disabled={activeSlide === 0}
                onClick={() => setActiveSlide(prev => Math.max(0, prev - 1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer border-none"
                title="Previous Slide"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-medium text-slate-700">
                {activeSlide + 1} <span className="text-slate-400">/ {totalSlides}</span>
              </span>
              <button
                disabled={activeSlide === totalSlides - 1}
                onClick={() => setActiveSlide(prev => Math.min(totalSlides - 1, prev + 1))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 transition cursor-pointer border-none"
                title="Next Slide"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(!inFullscreen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border-none"
              >
                {inFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span className="hidden sm:inline">{inFullscreen ? "Exit" : "Fullscreen"}</span>
              </button>

              {artifact.downloadUrl && (
                <a
                  href={artifact.downloadUrl}
                  download
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold no-underline shadow-2xs transition"
                >
                  <Download size={13} /> Download .pptx
                </a>
              )}
            </div>
          </div>

          {/* Thumbnails list */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {slides.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSlide(idx)}
                className={`w-24 h-12 rounded-lg border text-[9px] p-1.5 flex flex-col justify-between shrink-0 transition text-left cursor-pointer overflow-hidden ${
                  activeSlide === idx
                    ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 font-semibold shadow-2xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="truncate">{idx + 1}. {s.title}</span>
                <span className="text-[8px] text-slate-400 font-mono uppercase">{s.type || "slide"}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ==================== PDF RENDERER ====================
  const renderPdf = (inFullscreen = false) => {
    const pdfData = artifact?.data || {}
    const sections = pdfData?.sections || []
    const fileUrl = artifact?.fileUrl || ""

    return (
      <div className="flex flex-col h-full bg-slate-100/70 overflow-hidden">
        {/* PDF Top Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-amber-700 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate">
              {artifact.title || "PDF Document"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {fileUrl && (
              <div className="flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-lg">
                <button
                  onClick={() => setPdfViewMode("document")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition ${
                    pdfViewMode === "document" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Document
                </button>
                <button
                  onClick={() => setPdfViewMode("raw")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition ${
                    pdfViewMode === "raw" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  PDF Embed
                </button>
              </div>
            )}

            <button
              onClick={() => setIsFullscreen(!inFullscreen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer border-none"
            >
              {inFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{inFullscreen ? "Exit" : "Fullscreen"}</span>
            </button>

            {artifact.downloadUrl && (
              <a
                href={artifact.downloadUrl}
                download
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold no-underline shadow-2xs transition"
              >
                <Download size={13} /> Download .pdf
              </a>
            )}
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/70">
          {fileUrl && pdfViewMode === "raw" ? (
            <div className="w-full h-full min-h-[450px] rounded-xl overflow-hidden border border-slate-200 shadow-lg bg-white">
              <iframe
                title={artifact.title || "PDF Preview"}
                src={`${fileUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full min-h-[500px] border-none"
              />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto bg-white border border-slate-200/90 rounded-2xl p-6 md:p-8 shadow-md text-slate-800 space-y-5">
              {/* Document Header */}
              <div className="border-b border-slate-200 pb-4">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                  {pdfData.category || "TECHNICAL REPORT"}
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-1">
                  {pdfData.title || artifact.title}
                </h1>
                {pdfData.subtitle && (
                  <p className="text-xs text-slate-500">{pdfData.subtitle}</p>
                )}
              </div>

              {/* Executive Summary Callout */}
              {(pdfData.summary || pdfData.executiveSummary) && (
                <div className="bg-indigo-50/70 border-l-4 border-indigo-600 rounded-r-xl p-3.5 space-y-1">
                  <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wide">
                    Executive Summary
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {pdfData.summary || pdfData.executiveSummary}
                  </p>
                </div>
              )}

              {/* Document Sections */}
              <div className="space-y-4 pt-1">
                {sections.map((sec, i) => (
                  <div key={i} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <span className="text-xs font-mono text-indigo-600">{i + 1}.0</span>
                      <span>{sec.heading}</span>
                    </h3>
                    {sec.paragraph && (
                      <p className="text-xs text-slate-600 leading-relaxed">{sec.paragraph}</p>
                    )}
                    <ul className="space-y-1.5 text-xs text-slate-700 pl-1">
                      {(sec.points || []).map((pt, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Table / Comparative Matrix */}
              {pdfData.table && pdfData.table.headers && (
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-slate-800">
                    {pdfData.table.title || "Comparative Matrix"}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                          {(pdfData.table.headers || []).map((h, hIdx) => (
                            <th key={hIdx} className="p-2 font-semibold text-[11px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(pdfData.table.rows || []).map((row, rIdx) => (
                          <tr key={rIdx} className={rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                            {(Array.isArray(row) ? row : Object.values(row)).map((cell, cIdx) => (
                              <td key={cIdx} className="p-2 text-[11px] text-slate-700">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actionable Recommendations */}
              {pdfData.recommendations && pdfData.recommendations.length > 0 && (
                <div className="bg-emerald-50/70 border-l-4 border-emerald-600 rounded-r-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">
                    Actionable Recommendations
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {pdfData.recommendations.map((rec, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-2">
                        <span className="text-emerald-700 font-bold shrink-0">{rIdx + 1}.</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==================== MAIN PANEL ====================
  const PanelContent = ({ onClose }) => {
    return (
      <>
        {!collapsed ? (
          <div className='flex flex-col h-full bg-white'>
            {/* Header */}
            <div className='h-14 px-4 border-b border-slate-200 flex items-center gap-3 shrink-0 bg-white'>
              <button
                className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
                onClick={onClose ?? (() => setCollapsed(true))}
              >
                {onClose ? <X size={15} /> : <PanelRightClose size={16} />}
              </button>

              <div className='flex items-center gap-2 flex-1 min-w-0'>
                <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 shrink-0'>
                  {type === "Presentation" ? (
                    <Presentation className="text-purple-600" size={13} />
                  ) : type === "PDF" ? (
                    <FileText className="text-amber-700" size={13} />
                  ) : (
                    <Code2 className="text-blue-600" size={13} />
                  )}
                </div>
                <div className='text-[13px] font-semibold text-slate-800 truncate'>
                  {artifact?.title || "Artifact Preview"}
                </div>
              </div>

              {/* Action Buttons */}
              {type === "Project" && (
                <div className='flex items-center gap-1 shrink-0'>
                  <button
                    onClick={() => handleCopy(file?.content)}
                    className='flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors duration-150 bg-transparent border-none cursor-pointer'
                    title="Copy Code"
                  >
                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>

                  {canPreview && (
                    <div className='flex items-center gap-1 bg-slate-100 border border-slate-200 p-0.5 rounded-lg'>
                      <button
                        onClick={() => setTab("code")}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 border-none cursor-pointer ${
                          tab === "code" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-800 bg-transparent"
                        }`}
                      >
                        <Code2 size={11} /> Code
                      </button>
                      <button
                        onClick={() => setTab("preview")}
                        className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 border-none cursor-pointer ${
                          tab === "preview" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500 hover:text-slate-800 bg-transparent"
                        }`}
                      >
                        <Eye size={11} /> Preview
                      </button>
                    </div>
                  )}
                </div>
              )}

              {type === "Project" && (
                <div className="flex items-center gap-1">
                  {artifact.downloadUrl && (
                    <a
                      href={artifact.downloadUrl}
                      download
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 no-underline"
                      title="Download Entire Project Workspace as ZIP"
                    >
                      <Download size={12} />
                      <span>ZIP</span>
                    </a>
                  )}
                  {file?.content && (
                    <button
                      onClick={handleDownloadActiveFile}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition border-none bg-transparent cursor-pointer"
                      title={`Download active file: ${file.name || 'File'}`}
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              )}

              {artifact.downloadUrl && type !== "Presentation" && type !== "PDF" && type !== "Project" && (
                <a
                  href={artifact.downloadUrl}
                  download
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                  title="Download File"
                >
                  <Download size={14} />
                </a>
              )}
            </div>

            {/* Code Tabs */}
            {type === "Project" && tab === "code" && (
              <div className='flex h-auto border-b border-slate-200 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 bg-slate-50'>
                {artifact?.files?.map((f, index) => (
                  <button
                    key={f?.name || index}
                    onClick={() => setActiveFile(index)}
                    className={`px-4 py-2 text-[11px] font-medium whitespace-nowrap transition-colors duration-150 border-r border-slate-200 relative cursor-pointer ${
                      activeFile === index ? "text-indigo-600 bg-white font-semibold" : "text-slate-500 hover:text-slate-800 bg-transparent"
                    }`}
                  >
                    {f?.name}
                    {activeFile === index && (
                      <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-600' />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Body by Type */}
            <div className='flex-1 overflow-hidden'>
              {type === "Presentation" ? (
                renderPresentation(false)
              ) : type === "PDF" ? (
                renderPdf(false)
              ) : tab === "preview" && canPreview ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className='w-full h-full'
                >
                  <iframe title='preview' srcDoc={previewDoc} sandbox='allow-scripts allow-modals allow-forms allow-same-origin' className='w-full h-full bg-white border-0' />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className='w-full h-full'
                >
                  <Editor
                    theme='vs-light'
                    language={detectLanguage(file?.name)}
                    value={file?.content || ""}
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      fontSize: 13,
                      wordWrap: "on",
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
                      lineNumbers: "on",
                      renderLineHighlight: "none"
                    }}
                  />
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className='hidden lg:flex h-full border-l border-slate-200 bg-white flex-col items-center py-4 gap-3 shrink-0'>
            <button
              className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
              onClick={() => setCollapsed(false)}
            >
              <PanelRightOpen size={16} />
            </button>
            <div className='flex items-center gap-2 flex-1 min-w-0'>
              <div
                className='text-[10px] font-semibold text-slate-500 tracking-widest uppercase whitespace-nowrap'
                style={{
                  writingMode: "vertical-lr",
                  transform: "rotate(180deg)"
                }}
              >
                {artifact?.title}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {/* Mobile Floating Trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium shadow-lg shadow-indigo-500/25 border-none cursor-pointer transition-colors duration-150"
      >
        {type === "Presentation" ? <Presentation size={14} /> : type === "PDF" ? <FileText size={14} /> : <Code2 size={14} />}
        <span>View {type === "Presentation" ? "Slides" : type === "PDF" ? "PDF" : "Code"}</span>
      </button>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-[92vw] max-w-[460px] border-l border-white/[0.06] overflow-hidden"
            >
              <PanelContent onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Fullscreen Presentation / PDF Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex flex-col"
          >
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                {type === "Presentation" ? <Presentation className="text-purple-600" size={16} /> : <FileText className="text-amber-700" size={16} />}
                <span className="text-sm font-semibold text-slate-800">{artifact.title}</span>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg bg-slate-100 hover:bg-slate-200 transition cursor-pointer border-none"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100">
              {type === "Presentation" ? renderPresentation(true) : renderPdf(true)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Persistent Side Drawer */}
      <motion.div
        initial={{ width: 440 }}
        animate={{ width: collapsed ? 48 : 440 }}
        transition={{
          duration: 0.25,
          ease: easeInOut
        }}
        className='hidden lg:flex h-full border-l border-slate-200 flex-col overflow-hidden shrink-0'
      >
        <PanelContent />
      </motion.div>
    </>
  )
}

export default Artifact

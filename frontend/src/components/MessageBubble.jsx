import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Check,
  Code2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Presentation,
  Sparkles,
  Zap,
  X
} from 'lucide-react'
import { setArtifacts } from '../redux/messageSlice'

// Agent Meta Info Dictionary
const AGENT_CONFIG = {
  coding: {
    name: "Coding Specialist",
    icon: Code2,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200/80 text-blue-700",
    dot: "bg-blue-600"
  },
  ppt: {
    name: "Presentation Designer",
    icon: Presentation,
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200/80 text-purple-700",
    dot: "bg-purple-600"
  },
  pdf: {
    name: "Document Publisher",
    icon: FileText,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200/80 text-amber-800",
    dot: "bg-amber-700"
  },
  pdfRag: {
    name: "Document & Data Analyst",
    icon: FileSpreadsheet,
    color: "text-teal-700",
    bg: "bg-teal-50 border-teal-200/80 text-teal-800",
    dot: "bg-teal-700"
  },
  vision: {
    name: "Visual & Image Studio",
    icon: ImageIcon,
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200/80 text-rose-700",
    dot: "bg-rose-600"
  },
  imageAnalyzer: {
    name: "Image & Vision Analyst",
    icon: Sparkles,
    color: "text-pink-700",
    bg: "bg-pink-50 border-pink-200/80 text-pink-700",
    dot: "bg-pink-600"
  },
  search: {
    name: "Web Intelligence Agent",
    icon: Globe,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200/80 text-emerald-800",
    dot: "bg-emerald-600"
  },
  billing: {
    name: "Billing & Account Assistant",
    icon: CreditCard,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200/80 text-amber-800",
    dot: "bg-amber-600"
  },
  chat: {
    name: "Nexora Assistant",
    icon: MessageSquare,
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200/80 text-indigo-700",
    dot: "bg-indigo-600"
  }
}

function MessageBubble({ role, agent, content, images = [], artifacts = [], sources = [] }) {
  const isUser = role === "user"
  const dispatch = useDispatch()
  const [lightBox, setLightBox] = useState(null)
  const [copiedCode, setCopiedCode] = useState("")

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => {
      setCopiedCode("")
    }, 2000)
  }

  const handleOpenArtifact = (art) => {
    dispatch(setArtifacts([art]))
  }

  // Filter out standalone images if already rendered via Markdown
  const standaloneImages = (images || []).filter(img => !content?.includes(img))

  const cleanDomain = (url = "") => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.replace(/^www\./, "")
    } catch {
      return "web"
    }
  }

  // Infer agent if not explicitly passed
  const inferredAgentKey = agent || (
    artifacts?.[0]?.type === "Presentation" ? "ppt" :
    artifacts?.[0]?.type === "PDF" ? "pdf" :
    artifacts?.[0]?.type === "Project" ? "coding" :
    images?.length > 0 ? "vision" :
    sources?.length > 0 ? "search" :
    "chat"
  )

  const activeAgent = AGENT_CONFIG[inferredAgentKey] || AGENT_CONFIG.chat
  const AgentIcon = activeAgent.icon

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      <div
        className={`w-fit max-w-[94vw] md:max-w-[80%] px-4 py-3 rounded-2xl break-words overflow-hidden leading-relaxed transition-all ${
          isUser
            ? "bg-slate-900 text-white rounded-tr-xs shadow-xs"
            : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs"
        }`}
      >
        {/* Assistant Header: Active Specialized Agent Badge */}
        {!isUser && (
          <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${activeAgent.bg}`}>
              <AgentIcon size={12} className={activeAgent.color} />
              <span className={activeAgent.color}>{activeAgent.name}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Nexora Engine</span>
          </div>
        )}

        {/* Search Sources & Citations Section */}
        {sources && sources.length > 0 && !isUser && (
          <div className="mb-3 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              <Globe size={12} className="text-emerald-600" />
              <span>Verified Sources ({sources.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Source: ${src.title || src.url}`}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 active:scale-[0.98] border border-slate-200 text-[11px] text-slate-700 hover:text-slate-900 no-underline transition max-w-[240px] truncate group shadow-2xs"
                  title={src.title || src.url}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-medium truncate">{src.title || cleanDomain(src.url)}</span>
                  <span className="text-[9px] text-slate-400 shrink-0 font-mono">
                    {cleanDomain(src.url)}
                  </span>
                  <ExternalLink size={10} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Standalone Images */}
        {standaloneImages.length > 0 && (
          <div className='flex flex-wrap gap-3 mb-3'>
            {standaloneImages.map((img, i) => (
              <div key={i} className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xs">
                <img
                  src={img}
                  alt="Generated visual"
                  onClick={() => setLightBox(img)}
                  loading="lazy"
                  className="w-full max-w-[360px] max-h-[280px] rounded-xl object-contain cursor-zoom-in group-hover:scale-[1.02] transition duration-200"
                />
              </div>
            ))}
          </div>
        )}

        {/* Markdown Content */}
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className='text-lg md:text-xl font-bold mt-4 mb-2 text-slate-900'>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className='text-base md:text-lg font-semibold mt-3 mb-2 text-slate-900'>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className='text-sm md:text-base font-semibold mt-2 mb-1.5 text-slate-800'>{children}</h3>
            ),
            p: ({ children }) => (
              <p className={`mb-2.5 whitespace-pre-wrap break-words leading-relaxed text-[13.5px] ${isUser ? "text-white" : "text-slate-700"}`}>{children}</p>
            ),
            ul: ({ children }) => (
              <ul className={`list-disc pl-5 space-y-1.5 my-2 text-[13px] ${isUser ? "text-slate-100" : "text-slate-700"}`}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className={`list-decimal pl-5 space-y-1.5 my-2 text-[13px] ${isUser ? "text-slate-100" : "text-slate-700"}`}>{children}</ol>
            ),
            table: ({ children }) => (
              <div className='overflow-x-auto my-3 rounded-xl border border-slate-200 bg-white shadow-2xs'>
                <table className='min-w-full text-xs text-slate-700 border-collapse'>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className='border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-800'>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className='border-b border-slate-100 px-3 py-2'>
                {children}
              </td>
            ),
            a: ({ href, children }) => {
              const isDownload = href?.includes("download") || /\.(pdf|pptx|png|jpg|jpeg)$/i.test(href || "")
              return (
                <a
                  href={href}
                  target={isDownload ? "_self" : "_blank"}
                  download={isDownload}
                  rel="noreferrer"
                  className={
                    isDownload
                      ? "mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs no-underline transition shadow-xs cursor-pointer"
                      : "text-indigo-600 hover:text-indigo-700 underline inline-flex items-center gap-1 text-[13px] font-medium"
                  }
                >
                  {isDownload && <Download size={13} />}
                  {children}
                  {!isDownload && <ExternalLink size={11} />}
                </a>
              )
            },
            code: ({ className, children }) => {
              const value = String(children).trim()
              if (!className) {
                return (
                  <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isUser ? "bg-white/20 text-white" : "bg-slate-100 text-indigo-700 border border-slate-200/80"}`}>
                    {value}
                  </code>
                )
              }
              const language = className.replace("language-", "")
              return (
                <div className='my-3 overflow-hidden rounded-xl border border-slate-800 bg-[#0d1117] shadow-xs'>
                  <div className='flex items-center justify-between bg-[#161b22] border-b border-slate-800 px-4 py-2'>
                    <span className='uppercase text-xs font-semibold text-slate-300 font-mono'>
                      {language}
                    </span>
                    <button
                      className='flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-2 py-1 rounded transition cursor-pointer border-none'
                      onClick={() => copyCode(value)}
                    >
                      {copiedCode === value ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <SyntaxHighlighter
                    language={language}
                    style={oneDark}
                    wrapLongLines
                    showLineNumbers
                    customStyle={{
                      margin: 0,
                      padding: "14px 16px",
                      background: "#0d1117",
                      fontSize: "12.5px",
                    }}
                  >
                    {value}
                  </SyntaxHighlighter>
                </div>
              )
            },
            img: ({ src, alt }) => {
              if (!src) return null
              return (
                <span className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 inline-block shadow-2xs">
                  <img
                    src={src}
                    alt={alt || "Generated visual"}
                    onClick={() => setLightBox(src)}
                    loading="lazy"
                    className="w-full max-w-[420px] max-h-[320px] rounded-xl object-contain cursor-zoom-in hover:opacity-95 transition block"
                  />
                </span>
              )
            }
          }}
        >
          {content}
        </Markdown>

        {/* Interactive Artifact Preview Action Cards */}
        {artifacts && artifacts.length > 0 && !isUser && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2.5">
            {artifacts.map((art, i) => (
              <div
                key={art.id || i}
                className="flex items-center justify-between gap-3 w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                    {art.type === "Presentation" ? (
                      <Presentation size={15} className="text-purple-600" />
                    ) : art.type === "PDF" ? (
                      <FileText size={15} className="text-amber-700" />
                    ) : (
                      <Code2 size={15} className="text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{art.title || "Interactive Artifact"}</p>
                    <p className="text-[10px] text-slate-500 truncate font-medium">
                      {art.type === "Presentation"
                        ? `${art.slides?.length || 0} Slides Deck`
                        : art.type === "PDF"
                        ? "Formatted PDF Document"
                        : `${art.files?.length || 0} Source Files`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenArtifact(art)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer shadow-2xs flex items-center gap-1 border-none"
                  >
                    {art.type === "Presentation" ? (
                      <>
                        <Presentation size={12} />
                        <span>Open Slides</span>
                      </>
                    ) : art.type === "PDF" ? (
                      <>
                        <FileText size={12} />
                        <span>Preview PDF</span>
                      </>
                    ) : (
                      <>
                        <Code2 size={12} />
                        <span>Open Code</span>
                      </>
                    )}
                  </button>

                  {art.downloadUrl && (
                    <a
                      href={art.downloadUrl}
                      download
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Zoom Modal */}
      {lightBox && (
        <div
          className='fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6'
          onClick={() => setLightBox(null)}
        >
          <button
            className='absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition cursor-pointer border-none'
            onClick={() => setLightBox(null)}
          >
            <X size={18} />
          </button>
          <img
            src={lightBox}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl border border-white/15 shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  )
}

export default MessageBubble

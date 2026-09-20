import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Eye, Layers, Maximize2, Presentation, X } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

function MessageBubble({ role, content = "", images = [], artifacts = [], createdAt }) {
  const isUser = role === "user"
  const [lightBox, setLightBox] = useState(null)
  const [copiedCode, setCopiedCode] = useState("")
  const [currentSlide, setCurrentSlide] = useState(0)
  const [fullscreenSlide, setFullscreenSlide] = useState(false)
  const [viewMode, setViewMode] = useState("slides") // 'slides' or 'outline'

  const formattedTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ""

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightBox(null)
        setFullscreenSlide(false)
      }
    }
    if (lightBox || fullscreenSlide) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [lightBox, fullscreenSlide])

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => {
      setCopiedCode("")
    }, 2000)
  }

  // Parse Presentation Slides from artifacts or content
  const presentationData = useMemo(() => {
    const pptArtifact = artifacts?.find(a => a?.type === "Presentation" || (Array.isArray(a?.slides) && a.slides.length > 0))
    if (pptArtifact && Array.isArray(pptArtifact.slides) && pptArtifact.slides.length > 0) {
      return {
        title: pptArtifact.title || "Presentation Slides",
        slides: pptArtifact.slides,
        downloadUrl: pptArtifact.downloadUrl || null
      }
    }

    if (!content || !content.includes("### Slide")) return null
    try {
      const slideRegex = /###\s+Slide\s+\d+:\s*([^\n]+)\n([\s\S]*?)(?=(?:###\s+Slide|\n---|\n📥|$))/gi
      const matches = [...content.matchAll(slideRegex)]
      if (matches.length === 0) return null

      const slides = matches.map((m, idx) => {
        const title = m[1].trim()
        const body = m[2].trim()
        const points = body
          .split("\n")
          .map(line => line.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean)
        return { id: idx + 1, title, points }
      })

      const downloadMatch = content.match(/\[Download[^\]]*\]\((https?:\/\/[^\s)]+)\)/i)
      const downloadUrl = downloadMatch ? downloadMatch[1] : null

      const titleMatch = content.match(/#\s*(?:📊\s*)?(?:Presentation:\s*)?([^\n]+)/i)
      const title = titleMatch ? titleMatch[1].replace(/📊|Presentation:/g, "").trim() : "Presentation Slides"

      return { title, slides, downloadUrl }
    } catch {
      return null
    }
  }, [artifacts, content])

  const handleDownloadFile = (url, defaultName = "download") => {
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = defaultName
    a.target = "_blank"
    a.rel = "noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} my-1`}>
      <div className={`w-fit max-w-[92vw] md:max-w-[75%]
  px-4 py-3 rounded-2xl
  break-words overflow-hidden
  leading-relaxed
        ${isUser
          ? "bg-gradient-to-br from-indigo-500 to-violet-700 text-white rounded-tr-sm shadow-md shadow-indigo-500/10"
          : "bg-[#12151d]/70 border border-white/[0.06] text-slate-200 rounded-tl-sm shadow-sm"
        }`}>

        {/* In-App Interactive Presentation Viewer */}
        {presentationData && presentationData.slides.length > 0 && (
          <div className='my-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-b from-[#161a26] to-[#0f121a] overflow-hidden shadow-xl'>
            {/* Presentation Header */}
            <div className='px-4 py-3 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap'>
              <div className='flex items-center gap-2 min-w-0'>
                <div className='p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400'>
                  <Presentation size={16} />
                </div>
                <div>
                  <h4 className='text-sm font-semibold text-white truncate max-w-[280px] md:max-w-md'>
                    {presentationData.title}
                  </h4>
                  <p className='text-[11px] text-slate-400'>
                    {presentationData.slides.length} Interactive Slides
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-1.5'>
                <button
                  onClick={() => setViewMode(v => v === "slides" ? "outline" : "slides")}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-colors border border-white/[0.05]'
                  title={viewMode === "slides" ? "Switch to Outline" : "Switch to Slide Deck"}
                >
                  <Layers size={13} />
                  {viewMode === "slides" ? "Outline" : "Slides"}
                </button>

                <button
                  onClick={() => setFullscreenSlide(true)}
                  className='flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 transition-colors border border-indigo-500/30'
                  title="Open Fullscreen Slide View"
                >
                  <Maximize2 size={13} />
                  Present
                </button>

                {presentationData.downloadUrl && (
                  <a
                    href={presentationData.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className='flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors no-underline shadow-sm'
                    title="Download Presentation File"
                  >
                    <Download size={13} />
                    Download
                  </a>
                )}
              </div>
            </div>

            {/* Presentation Body */}
            {viewMode === "slides" ? (
              <div className='p-5'>
                {/* Active Slide Card */}
                {(() => {
                  const slide = presentationData.slides[currentSlide] || presentationData.slides[0]
                  return (
                    <div className='min-h-[220px] rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 flex flex-col justify-between backdrop-blur-xs'>
                      <div>
                        <div className='flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2.5'>
                          <span className='text-[11px] font-semibold tracking-wider uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md'>
                            Slide {currentSlide + 1} of {presentationData.slides.length}
                          </span>
                          <span className='text-xs text-slate-500'>
                            {presentationData.title}
                          </span>
                        </div>
                        <h3 className='text-lg font-bold text-white mb-3'>
                          {slide?.title}
                        </h3>
                        <ul className='space-y-2 text-slate-300 text-[13px]'>
                          {slide?.points?.map((pt, pIdx) => (
                            <li key={pIdx} className='flex items-start gap-2.5'>
                              <span className='h-1.5 w-1.5 rounded-full bg-indigo-400 mt-2 shrink-0' />
                              <span className='leading-relaxed'>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Controls inside card */}
                      <div className='flex items-center justify-between mt-5 pt-3 border-t border-white/[0.06]'>
                        <button
                          disabled={currentSlide === 0}
                          onClick={() => setCurrentSlide(s => Math.max(0, s - 1))}
                          className='flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors'
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>

                        {/* Slide Dots */}
                        <div className='flex items-center gap-1.5'>
                          {presentationData.slides.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`h-2 rounded-full transition-all ${
                                currentSlide === idx ? "w-6 bg-indigo-500" : "w-2 bg-white/20 hover:bg-white/40"
                              }`}
                              title={`Go to Slide ${idx + 1}`}
                            />
                          ))}
                        </div>

                        <button
                          disabled={currentSlide === presentationData.slides.length - 1}
                          onClick={() => setCurrentSlide(s => Math.min(presentationData.slides.length - 1, s + 1))}
                          className='flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors'
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}
          </div>
        )}

        {/* Attached or Returned Images List */}
        {images.length > 0 && (
          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-3'>
            {images.map((img, i) => (
              <div key={i} className='group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg aspect-video'>
                <img
                  src={img}
                  alt={`Image ${i + 1}`}
                  onClick={() => setLightBox(img)}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform duration-300"
                />
                <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none'>
                  <span className='text-xs text-white/90 font-medium truncate pointer-events-auto'>
                    Image {i + 1}
                  </span>
                  <div className='flex items-center gap-1.5 pointer-events-auto'>
                    <button
                      onClick={() => setLightBox(img)}
                      title="Open Fullscreen Preview"
                      className='p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition cursor-pointer border-none'
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => handleDownloadFile(img, `image-${i + 1}.jpg`)}
                      title="Download Image"
                      className='p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition cursor-pointer border-none'
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Markdown Content */}
        {(!presentationData || viewMode === "outline") && (
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className='text-2xl font-bold mt-4 mb-2 text-white'>{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className='text-xl font-semibold mt-3 mb-2 text-white'>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className='text-lg font-semibold mt-3 mb-1.5 text-indigo-200'>{children}</h3>
              ),
              p: ({ children }) => (
                <p className='mb-2.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed'>{children}</p>
              ),
              ul: ({ children }) => (
                <ul className='list-disc pl-5 space-y-1 my-2 text-[13.5px]'>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className='list-decimal pl-5 space-y-1 my-2 text-[13.5px]'>{children}</ol>
              ),
              table: ({ children }) => (
                <div className='overflow-x-auto my-3'>
                  <table className='min-w-full border border-white/10 rounded-lg overflow-hidden text-xs'>
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className='border border-white/10 bg-white/5 px-3 py-2 text-left font-medium text-slate-300'>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className='border border-white/10 px-3 py-2 text-slate-300'>
                  {children}
                </td>
              ),
              a: ({ href, children }) => {
                const isDownload = String(children).toLowerCase().includes("download") || href?.includes("download") || href?.endsWith(".pdf") || href?.endsWith(".pptx")
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 my-1 rounded-xl transition-all ${
                      isDownload
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white no-underline shadow-sm cursor-pointer"
                        : "text-indigo-400 hover:text-indigo-300 underline"
                    }`}
                  >
                    {isDownload ? <Download size={13} /> : null}
                    {children}
                    {!isDownload && <ExternalLink size={12} />}
                  </a>
                )
              },
              code: ({ className, children }) => {
                const value = String(children).trim()

                if (!className) {
                  return (
                    <code className='px-1.5 py-0.5 rounded bg-white/10 text-indigo-200 text-xs font-mono'>
                      {value}
                    </code>
                  )
                }

                const language = className.replace("language-", "")

                return (
                  <div className='my-3 overflow-hidden rounded-xl border border-white/10 bg-[#111318] shadow-md'>
                    <div className='flex items-center justify-between bg-[#1b1d24] border-b border-white/10 px-4 py-2'>
                      <span className='uppercase text-xs font-medium text-slate-400 tracking-wider'>
                        {language}
                      </span>
                      <button
                        className='flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-transparent border-none cursor-pointer transition'
                        onClick={() => copyCode(value)}
                      >
                        {copiedCode === value ? (
                          <>
                            <Check size={13} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
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
                        padding: "14px",
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
                if (images.includes(src)) return null
                return (
                  <div className='my-3 relative group inline-block rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg'>
                    <img
                      src={src}
                      alt={alt || "Generated Artwork"}
                      onClick={() => setLightBox(src)}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                      className="max-w-xs md:max-w-md max-h-80 rounded-2xl object-contain cursor-zoom-in hover:opacity-95 transition"
                    />
                    <div className='absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <button
                        onClick={() => setLightBox(src)}
                        title="View Fullscreen"
                        className='p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white backdrop-blur-md transition border-none cursor-pointer'
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => handleDownloadFile(src, "artwork.jpg")}
                        title="Download Image"
                        className='p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition border-none cursor-pointer'
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                )
              }
            }}
          >
            {content}
          </Markdown>
        )}

        {formattedTime && (
          <div className={`text-[10px] mt-1.5 select-none flex ${isUser ? "justify-end text-white/70" : "justify-start text-slate-500"}`}>
            {formattedTime}
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {lightBox && (
        <div className='fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8 animate-fadeIn'>
          {/* Lightbox Toolbar */}
          <div className='absolute top-4 right-4 flex items-center gap-2'>
            <button
              onClick={() => handleDownloadFile(lightBox, "downloaded-image.jpg")}
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-lg'
            >
              <Download size={14} /> Download
            </button>
            <a
              href={lightBox}
              target="_blank"
              rel="noreferrer"
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition no-underline backdrop-blur-md'
            >
              <ExternalLink size={14} /> Open URL
            </a>
            <button
              className='text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 transition backdrop-blur-md'
              onClick={() => setLightBox(null)}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          <img
            src={lightBox}
            alt="Fullscreen preview"
            className="max-w-[92vw] max-h-[82vh] rounded-2xl border border-white/10 shadow-2xl object-contain"
          />
        </div>
      )}

      {/* Fullscreen Presentation Modal */}
      {fullscreenSlide && presentationData && (
        <div className='fixed inset-0 z-50 bg-[#090b10]/95 backdrop-blur-lg flex flex-col justify-between p-6 md:p-10'>
          {/* Modal Header */}
          <div className='flex items-center justify-between border-b border-white/10 pb-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 rounded-xl bg-indigo-500/20 text-indigo-400'>
                <Presentation size={20} />
              </div>
              <div>
                <h2 className='text-lg md:text-xl font-bold text-white'>
                  {presentationData.title}
                </h2>
                <p className='text-xs text-slate-400'>
                  Slide {currentSlide + 1} of {presentationData.slides.length}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              {presentationData.downloadUrl && (
                <a
                  href={presentationData.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition no-underline'
                >
                  <Download size={14} /> Download (.pptx)
                </a>
              )}
              <button
                onClick={() => setFullscreenSlide(false)}
                className='p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition'
                title="Close Presenter Mode"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Slide Content */}
          <div className='flex-1 flex items-center justify-center py-6'>
            {(() => {
              const slide = presentationData.slides[currentSlide] || presentationData.slides[0]
              return (
                <div className='w-full max-w-4xl bg-gradient-to-br from-[#151924] to-[#0e1017] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl min-h-[380px] flex flex-col justify-between'>
                  <div>
                    <div className='text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-2'>
                      Slide {currentSlide + 1}
                    </div>
                    <h1 className='text-2xl md:text-4xl font-extrabold text-white mb-6 leading-tight'>
                      {slide?.title}
                    </h1>
                    <ul className='space-y-4'>
                      {slide?.points?.map((pt, pIdx) => (
                        <li key={pIdx} className='flex items-start gap-3.5 text-base md:text-lg text-slate-200'>
                          <span className='h-2.5 w-2.5 rounded-full bg-indigo-400 mt-2 shrink-0' />
                          <span className='leading-relaxed'>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Modal Footer Controls */}
          <div className='flex items-center justify-between border-t border-white/10 pt-4'>
            <button
              disabled={currentSlide === 0}
              onClick={() => setCurrentSlide(s => Math.max(0, s - 1))}
              className='flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition'
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <div className='flex items-center gap-2'>
              {presentationData.slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentSlide === idx ? "w-8 bg-indigo-500" : "w-2.5 bg-white/20 hover:bg-white/40"
                  }`}
                  title={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              disabled={currentSlide === presentationData.slides.length - 1}
              onClick={() => setCurrentSlide(s => Math.min(presentationData.slides.length - 1, s + 1))}
              className='flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white transition'
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageBubble

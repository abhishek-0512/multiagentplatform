import { useState, useMemo } from "react"
import { useDispatch, useSelector } from "react-redux"
import { Check, Code2, Copy, Eye, FileCode, X } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { setArtifacts } from "../redux/messageSlice"

function Artifact() {
  const dispatch = useDispatch()
  const { artifacts } = useSelector((state) => state.message)
  const [activeArtifactIndex, setActiveArtifactIndex] = useState(0)
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [viewMode, setViewMode] = useState("code") // "code" | "preview"
  const [copied, setCopied] = useState(false)

  const currentArtifact = artifacts?.[activeArtifactIndex] || artifacts?.[0]
  const files = useMemo(() => currentArtifact?.files || [], [currentArtifact])
  const currentFile = files[selectedFileIndex] || files[0]

  const previewDoc = useMemo(() => {
    if (!files || files.length === 0) return ""
    const htmlFile = files.find((f) => f.name?.endsWith(".html"))?.content || ""
    const cssFile = files.find((f) => f.name?.endsWith(".css"))?.content || ""
    const jsFile = files.find((f) => f.name?.endsWith(".js"))?.content || ""

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${cssFile}</style></head><body>${htmlFile}<script>${jsFile}</script></body></html>`
  }, [files])

  if (!artifacts || artifacts.length === 0 || !currentArtifact) {
    return null
  }

  const handleCopy = async () => {
    if (!currentFile?.content) return
    await navigator.clipboard.writeText(currentFile.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getLanguage = (fileName = "") => {
    if (fileName.endsWith(".html")) return "html"
    if (fileName.endsWith(".css")) return "css"
    if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) return "javascript"
    if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript"
    if (fileName.endsWith(".json")) return "json"
    if (fileName.endsWith(".py")) return "python"
    return "javascript"
  }

  return (
    <div className="w-full md:w-[480px] lg:w-[540px] xl:w-[600px] h-screen bg-[#0f1219] border-l border-white/[0.08] flex flex-col shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#12151e]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <FileCode size={14} />
          </div>
          <span className="text-sm font-medium text-slate-200 truncate">
            {currentArtifact.title || "Project Artifact"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-white/[0.06] rounded-lg p-0.5 border border-white/[0.06]">
            <button
              onClick={() => setViewMode("code")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === "code"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code2 size={13} />
              Code
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                viewMode === "preview"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye size={13} />
              Preview
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={() => dispatch(setArtifacts([]))}
            className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] rounded-lg transition cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Artifacts selector if multiple */}
      {artifacts.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#0d0f14] border-b border-white/[0.06] overflow-x-auto">
          {artifacts.map((art, idx) => (
            <button
              key={art.id || idx}
              onClick={() => {
                setActiveArtifactIndex(idx)
                setSelectedFileIndex(0)
              }}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition cursor-pointer ${
                activeArtifactIndex === idx
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:bg-white/[0.04]"
              }`}
            >
              {art.title || `Artifact ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* File Tabs (Code mode) */}
      {viewMode === "code" && files.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#12151e] border-b border-white/[0.06]">
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {files.map((file, idx) => (
              <button
                key={file.name || idx}
                onClick={() => setSelectedFileIndex(idx)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                  selectedFileIndex === idx
                    ? "bg-white/[0.1] text-slate-100 border border-white/[0.1]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-white/[0.06] transition cursor-pointer shrink-0 ml-2"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* Body Area */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === "code" ? (
          <div className="h-full overflow-y-auto">
            {currentFile ? (
              <SyntaxHighlighter
                language={getLanguage(currentFile.name)}
                style={oneDark}
                showLineNumbers
                customStyle={{
                  margin: 0,
                  padding: "16px",
                  background: "#0f1219",
                  fontSize: "13px",
                  minHeight: "100%",
                }}
              >
                {currentFile.content || ""}
              </SyntaxHighlighter>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                No files in artifact
              </div>
            )}
          </div>
        ) : (
          <iframe
            title="Artifact Preview"
            srcDoc={previewDoc}
            className="w-full h-full border-none bg-white"
            sandbox="allow-scripts allow-modals"
          />
        )}
      </div>
    </div>
  )
}

export default Artifact

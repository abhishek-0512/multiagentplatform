import React, { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Bot,
  Code2,
  FileSpreadsheet,
  FileText,
  Globe,
  ImageIcon,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Presentation,
  Send,
  Sparkles,
  X,
  Zap
} from 'lucide-react'
import sendMessage from '../features/sendMessage'
import { addMessage, setActiveAgent, setArtifacts, setExecutingStatus, setIsLoading, setMessages } from '../redux/messageSlice'
import { createConversation } from '../features/createConversation'
import { addConversation, setConvTitle, setSelectedConversation } from '../redux/conversationSlice'
import { updateConversation } from '../features/updateConversation'

function ChatInput() {
  const [value, setValue] = useState("")
  const { selectedConversation } = useSelector(state => state.conversation)
  const { isLoading, activeAgent } = useSelector(state => state.message)
  const [selectedFile, setSelectedFile] = useState(null)
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState(null)

  const recognitionRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const baseTextRef = useRef("")
  const dispatch = useDispatch()

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onstart = () => {
      setListening(true)
      setMicError(null)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ""
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " "
        } else {
          interimTranscript += transcript
        }
      }

      const spoken = (finalTranscript + interimTranscript).trim()
      if (spoken) {
        const prefix = baseTextRef.current ? baseTextRef.current.trim() + " " : ""
        setValue(prefix + spoken)
      }
    }

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error)
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setMicError("Microphone permission denied. Please allow microphone access in your browser.")
      } else if (event.error === "no-speech") {
        // No speech detected
      } else {
        setMicError(`Voice error: ${event.error}`)
      }
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {}
      }
    }
  }, [])

  const toggleMic = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition || !recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.")
      return
    }

    if (listening) {
      try {
        recognitionRef.current.stop()
      } catch {}
      setListening(false)
    } else {
      setMicError(null)
      baseTextRef.current = value
      try {
        recognitionRef.current.start()
        setListening(true)
      } catch (err) {
        console.warn("Failed to start speech recognition:", err)
        try {
          recognitionRef.current.stop()
          setTimeout(() => {
            recognitionRef.current.start()
            setListening(true)
          }, 150)
        } catch {}
      }
    }
  }

  const handleSendMessage = async () => {
    if ((!value.trim() && !selectedFile) || isLoading) return

    // Stop voice if listening
    if (listening && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      setListening(false)
    }

    dispatch(setIsLoading(true))
    
    // Set dynamic execution status
    if (activeAgent === "auto") {
      dispatch(setExecutingStatus("Analyzing intent & routing to agent..."))
    } else if (activeAgent === "coding") {
      dispatch(setExecutingStatus("Generating multi-file code workspace..."))
    } else if (activeAgent === "ppt") {
      dispatch(setExecutingStatus("Designing structured presentation deck..."))
    } else if (activeAgent === "pdf") {
      dispatch(setExecutingStatus("Compiling publication PDF report..."))
    } else if (activeAgent === "pdfRag" || activeAgent === "rag") {
      dispatch(setExecutingStatus("Parsing document & retrieving context..."))
    } else if (activeAgent === "vision") {
      dispatch(setExecutingStatus("Synthesizing prompt-specific visual..."))
    } else if (activeAgent === "search") {
      dispatch(setExecutingStatus("Querying real-time web sources..."))
    } else {
      dispatch(setExecutingStatus("Processing request..."))
    }

    let conversation = selectedConversation
    if (!conversation) {
      dispatch(setMessages([]))
      const conv = await createConversation()
      dispatch(setSelectedConversation(conv))
      dispatch(addConversation(conv))
      conversation = conv
    }

    if (conversation?.title === "New Chat" && value.trim()) {
      const displayTitle = value.trim().slice(0, 40)
      await updateConversation({ id: conversation?._id, title: displayTitle }).catch(() => {})
      dispatch(setConvTitle({ conversationId: conversation?._id, title: displayTitle }))
    }

    const formData = new FormData()
    formData.append("prompt", value.trim())
    formData.append("conversationId", conversation?._id)
    formData.append("agent", activeAgent.toLowerCase())
    if (selectedFile) {
      formData.append("file", selectedFile)
    }

    const currentPrompt = value.trim() || (selectedFile ? `Uploaded ${selectedFile.name}` : "")
    dispatch(addMessage({ role: "user", content: currentPrompt }))
    setValue("")
    baseTextRef.current = ""
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ""

    const data = await sendMessage(formData)
    dispatch(setIsLoading(false))
    dispatch(setExecutingStatus(""))

    // DYNAMIC ACTIVE AGENT UPDATE: Update activeAgent from backend router result
    if (data?.agent) {
      const normalizedAgent = data.agent.toLowerCase()
      dispatch(setActiveAgent(normalizedAgent))
    }

    dispatch(setArtifacts(data?.artifacts || []))
    dispatch(addMessage({
      role: "assistant",
      agent: data?.agent || activeAgent,
      content: data?.answer,
      images: data?.images,
      artifacts: data?.artifacts,
      sources: data?.sources
    }))
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Detect file category icon & color
  const getFileBadge = (file) => {
    if (!file) return null
    const name = file.name.toLowerCase()
    const mime = file.type || ""

    if (name.endsWith(".pdf") || mime === "application/pdf") {
      return {
        icon: FileText,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        label: "PDF Document"
      }
    }
    if (name.endsWith(".docx") || name.endsWith(".doc") || mime.includes("word")) {
      return {
        icon: FileText,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
        label: "Word Document"
      }
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") || mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") {
      return {
        icon: FileSpreadsheet,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        label: name.endsWith(".csv") ? "CSV Dataset" : "Excel Sheet"
      }
    }
    if (mime.startsWith("image/")) {
      return {
        isImage: true,
        label: "Image Attachment"
      }
    }
    return {
      icon: FileText,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
      label: "Text File"
    }
  }

  const formatFileSize = (bytes = 0) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const agents = [
    { id: "auto", icon: Zap, label: "Auto", color: "text-amber-400" },
    { id: "chat", icon: MessageSquare, label: "Chat", color: "text-indigo-400" },
    { id: "coding", icon: Code2, label: "Coding", color: "text-blue-400" },
    { id: "search", icon: Globe, label: "Search", color: "text-emerald-400" },
    { id: "vision", icon: ImageIcon, label: "Vision", color: "text-rose-400" },
    { id: "pdf", icon: FileText, label: "PDF", color: "text-amber-400" },
    { id: "ppt", icon: Presentation, label: "PPT", color: "text-purple-400" },
    { id: "pdfRag", icon: FileSpreadsheet, label: "RAG", color: "text-cyan-400" }
  ]

  const fileBadge = getFileBadge(selectedFile)

  // Map active agent key for normalized comparison
  const normalizedActiveKey = (activeAgent || "auto").toLowerCase()
  const isAgentActive = (agentId) => {
    if (agentId === "pdfRag" && (normalizedActiveKey === "pdfrag" || normalizedActiveKey === "rag")) return true
    if (agentId === "vision" && (normalizedActiveKey === "vision" || normalizedActiveKey === "image" || normalizedActiveKey === "imageanalyzer")) return true
    return normalizedActiveKey === agentId.toLowerCase()
  }

  return (
    <div className='w-full overflow-hidden px-3 md:px-6 py-3 border-t border-slate-200/80 bg-[#f8fafc]'>
      <div className='flex flex-col gap-2.5 bg-white border border-slate-200 shadow-xs rounded-2xl px-3.5 pt-3 pb-2.5 relative max-w-4xl mx-auto'>
        
        {/* Agent Selector Pills */}
        <div className='flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          {agents.map((agent) => {
            const active = isAgentActive(agent.id)
            const Icon = agent.icon
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => dispatch(setActiveAgent(agent.id))}
                className={`
                  flex-shrink-0
                  cursor-pointer
                  inline-flex
                  items-center
                  gap-1.5
                  px-2.5
                  py-1
                  rounded-full
                  text-xs
                  font-medium
                  border
                  transition-all
                  duration-150
                  ${active
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs font-semibold"
                    : "bg-slate-50 text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900"
                  }
                `}
                title={agent.id === "auto" ? "Intelligent Automatic Intent Routing" : `Force ${agent.label} Specialist`}
              >
                <Icon size={12} className={active ? "text-white" : agent.color} />
                <span>{agent.label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* Selected File Attached Pill + Quick Action Chips */}
        {selectedFile && fileBadge && (
          <div className='my-1 space-y-2'>
            <div className='inline-flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-xs text-indigo-950'>
              {fileBadge.isImage ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Attachment preview"
                  className="h-8 w-8 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <fileBadge.icon size={16} className={fileBadge.color} />
              )}
              <div className="min-w-0">
                <p className='text-xs font-semibold text-slate-800 truncate max-w-[240px]'>
                  {selectedFile.name}
                </p>
                <p className='text-[10px] text-slate-500 font-mono'>
                  {fileBadge.label} • {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                type="button"
                className='p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer border-none bg-transparent'
                onClick={() => {
                  setSelectedFile(null)
                  if (fileRef.current) fileRef.current.value = ""
                }}
                title="Remove attachment"
              >
                <X size={13} />
              </button>
            </div>

            {/* Document Quick Action Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Actions:</span>
              <button
                type="button"
                onClick={() => {
                  setValue("Analyze this document in detail and extract the core facts and takeaways.")
                  textareaRef.current?.focus()
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition cursor-pointer"
              >
                Analyze Document
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("Create a comprehensive PDF report based on this analyzed document.")
                  textareaRef.current?.focus()
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
              >
                Create PDF Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("Create a 6-slide presentation deck based on this analyzed document.")
                  textareaRef.current?.focus()
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 transition cursor-pointer"
              >
                Create PPT Deck
              </button>
            </div>
          </div>
        )}

        {/* Mic Error Banner if any */}
        {micError && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center justify-between">
            <span>{micError}</span>
            <button onClick={() => setMicError(null)} className="text-amber-600 hover:text-amber-900 border-none bg-transparent cursor-pointer">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Live Listening Indicator */}
        {listening && (
          <div className="flex items-center gap-2 px-2 py-0.5 text-xs text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="font-medium animate-pulse">Listening... speak now</span>
          </div>
        )}

        {/* Textarea Input */}
        <textarea
          ref={textareaRef}
          placeholder={selectedFile ? `Ask Nexora about ${selectedFile.name}...` : 'Ask Nexora anything, analyze documents, write code...'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          value={value}
          rows={2}
          className="w-full bg-transparent outline-none resize-none text-[13.5px] text-slate-800 placeholder:text-slate-400 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
        />

        {/* Bottom Controls Bar */}
        <div className='flex items-center justify-between pt-1'>
          <div className='flex items-center gap-1.5'>
            {/* Multi-Format File Input */}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.json,.md,image/*"
              hidden
              ref={fileRef}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setSelectedFile(file)
                  if (activeAgent === "auto") {
                    dispatch(setActiveAgent("pdfRag"))
                  }
                }
              }}
            />

            <button
              type="button"
              className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border-none bg-transparent cursor-pointer'
              onClick={() => fileRef.current?.click()}
              title="Attach Document (PDF, Word, Excel, CSV, Text) or Image"
            >
              <Paperclip size={16} />
            </button>

            {/* Microphone Button */}
            <button
              type="button"
              onClick={toggleMic}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition border-none cursor-pointer ${
                listening
                  ? "bg-red-500 text-white shadow-xs animate-pulse"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 bg-transparent"
              }`}
              title={listening ? "Stop Listening" : "Voice Input (Speech to Text)"}
            >
              {listening ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
          </div>

          {/* Send Button */}
          <button
            type="button"
            disabled={(!value.trim() && !selectedFile) || isLoading}
            onClick={handleSendMessage}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition shadow-2xs ${
              (value.trim() || selectedFile) && !isLoading
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            title="Send Message (Enter)"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatInput

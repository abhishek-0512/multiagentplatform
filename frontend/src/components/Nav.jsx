import React from 'react'
import {
  Code2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Globe,
  ImageIcon,
  MessageSquare,
  Plus,
  Presentation,
  Sparkles,
  Zap
} from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { setSelectedConversation } from '../redux/conversationSlice'
import { setActiveAgent } from '../redux/messageSlice'

const AGENT_META = {
  coding: { name: "Coding Specialist", icon: Code2, color: "text-blue-600", bg: "bg-blue-50 border-blue-200/80 text-blue-700" },
  ppt: { name: "Presentation Designer", icon: Presentation, color: "text-purple-600", bg: "bg-purple-50 border-purple-200/80 text-purple-700" },
  pdf: { name: "Document Publisher", icon: FileText, color: "text-amber-700", bg: "bg-amber-50 border-amber-200/80 text-amber-800" },
  pdfRag: { name: "Document & Data Analyst", icon: FileSpreadsheet, color: "text-teal-700", bg: "bg-teal-50 border-teal-200/80 text-teal-800" },
  rag: { name: "Document & Data Analyst", icon: FileSpreadsheet, color: "text-teal-700", bg: "bg-teal-50 border-teal-200/80 text-teal-800" },
  vision: { name: "Visual & Image Studio", icon: ImageIcon, color: "text-rose-600", bg: "bg-rose-50 border-rose-200/80 text-rose-700" },
  image: { name: "Visual & Image Studio", icon: ImageIcon, color: "text-rose-600", bg: "bg-rose-50 border-rose-200/80 text-rose-700" },
  search: { name: "Web Intelligence", icon: Globe, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200/80 text-emerald-800" },
  billing: { name: "Billing Assistant", icon: CreditCard, color: "text-amber-700", bg: "bg-amber-50 border-amber-200/80 text-amber-800" },
  chat: { name: "Nexora Assistant", icon: MessageSquare, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200/80 text-indigo-700" },
  auto: { name: "Autonomous Router", icon: Zap, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200/80 text-indigo-700" }
}

function Nav() {
  const { selectedConversation } = useSelector(state => state.conversation)
  const { messages, activeAgent, isLoading, executingStatus } = useSelector(state => state.message)
  const dispatch = useDispatch()

  const currentAgentKey = (activeAgent || "auto").toLowerCase()
  const agentInfo = AGENT_META[currentAgentKey] || AGENT_META.auto
  const AgentIcon = agentInfo.icon

  return (
    <header className='h-13 flex items-center justify-between px-4 md:px-6 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs shrink-0 select-none'>
      {/* Left: Active Agent & Title */}
      <div className='flex items-center gap-3 min-w-0'>
        {/* Dynamic Active Agent Tag */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold shadow-2xs ${agentInfo.bg}`}>
          <AgentIcon size={13} className={agentInfo.color} />
          <span className={`${agentInfo.color} hidden sm:inline`}>{agentInfo.name}</span>
          <span className={`${agentInfo.color} sm:hidden`}>{agentInfo.name.split(" ")[0]}</span>
        </div>

        {/* Execution State or Conversation Title */}
        <div className='flex items-center gap-2 min-w-0'>
          {isLoading ? (
            <div className='flex items-center gap-2 text-xs font-medium text-indigo-600'>
              <span className='w-2 h-2 rounded-full bg-indigo-600 animate-ping' />
              <span className='truncate'>{executingStatus || "Executing..."}</span>
            </div>
          ) : (
            <>
              <h2 className='text-[13.5px] font-semibold text-slate-800 tracking-tight truncate max-w-[240px] md:max-w-md'>
                {selectedConversation?.title || "New Conversation"}
              </h2>
              <span className='hidden md:inline-block text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full font-mono'>
                {messages?.length || 0} msgs
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className='flex items-center gap-2'>
        <button
          onClick={() => {
            dispatch(setSelectedConversation(null))
            dispatch(setActiveAgent("auto"))
          }}
          className='flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-2xs transition cursor-pointer'
          title="Start fresh conversation"
        >
          <Plus size={13} />
          <span className='hidden sm:inline'>New Chat</span>
        </button>
      </div>
    </header>
  )
}

export default Nav

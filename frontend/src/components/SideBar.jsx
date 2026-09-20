import React, { useState, useEffect } from 'react'
import {
  Bot,
  Code2,
  Coins,
  CreditCard,
  Crown,
  FileSpreadsheet,
  FileText,
  Globe,
  ImageIcon,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Presentation,
  Sparkles,
  User,
  X,
  Zap
} from "lucide-react"
import { useDispatch, useSelector } from 'react-redux'
import { getConversations } from '../features/getConversations'
import { addConversation, setConversations, setSelectedConversation } from '../redux/conversationSlice'
import { createConversation } from '../features/createConversation'
import { setActiveAgent } from '../redux/messageSlice'
import logOut from '../features/logout'
import { setUserdata } from '../redux/userSlice'
import BillingDrawer from './BillingDrawer'

function SideBar() {
  const [collapsed, setCollapsed] = useState(false)
  const dispatch = useDispatch()
  const [imageError, setImageError] = useState(false)
  const { conversations, selectedConversation } = useSelector(state => state.conversation)
  const { userData } = useSelector(state => state.user)
  const { activeAgent } = useSelector(state => state.message)
  const [showBilling, setShowBilling] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const getConv = async () => {
      const data = await getConversations()
      dispatch(setConversations(data))
    }
    getConv()
  }, [userData?._id])

  const agentsList = [
    { id: "auto", name: "Intelligent Auto", icon: Zap, color: "text-amber-400" },
    { id: "chat", name: "Nexora Assistant", icon: MessageSquare, color: "text-indigo-400" },
    { id: "coding", name: "Coding Specialist", icon: Code2, color: "text-blue-400" },
    { id: "ppt", name: "Slide Designer", icon: Presentation, color: "text-purple-400" },
    { id: "pdf", name: "PDF Publisher", icon: FileText, color: "text-amber-400" },
    { id: "pdfRag", name: "Doc & Data RAG", icon: FileSpreadsheet, color: "text-cyan-400" },
    { id: "vision", name: "Vision Studio", icon: ImageIcon, color: "text-rose-400" },
    { id: "search", name: "Web Intelligence", icon: Globe, color: "text-emerald-400" }
  ]

  const normalizedActiveKey = (activeAgent || "auto").toLowerCase()
  const isAgentActive = (agentId) => {
    if (agentId === "pdfRag" && (normalizedActiveKey === "pdfrag" || normalizedActiveKey === "rag")) return true
    if (agentId === "vision" && (normalizedActiveKey === "vision" || normalizedActiveKey === "image" || normalizedActiveKey === "imageanalyzer")) return true
    return normalizedActiveKey === agentId.toLowerCase()
  }

  // Collapsed Desktop View
  if (collapsed) {
    return (
      <div className='hidden lg:flex flex-col items-center w-[64px] h-screen bg-white border-r border-slate-200 py-4 gap-2.5 shrink-0 select-none'>
        <button
          className='flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition bg-transparent border-none cursor-pointer'
          onClick={() => setCollapsed(false)}
          title="Expand Sidebar"
        >
          <PanelLeftOpen size={18} />
        </button>

        <button
          className='flex items-center justify-center w-9 h-9 rounded-xl text-white bg-slate-900 hover:bg-slate-800 transition border-none cursor-pointer shadow-xs'
          onClick={() => {
            dispatch(setSelectedConversation(null))
            dispatch(setActiveAgent("auto"))
          }}
          title="New Chat"
        >
          <Plus size={18} />
        </button>

        <div className='flex-1 overflow-y-auto px-2 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-1.5'>
          {conversations.map((conv, i) => {
            const isActive = selectedConversation?._id === conv?._id
            return (
              <button
                key={conv?._id || `conv-c-${i}`}
                onClick={() => dispatch(setSelectedConversation(conv))}
                className={`flex items-center justify-center w-9 h-9 rounded-xl border transition cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-transparent border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
                title={conv?.title || "Conversation"}
              >
                <MessageSquare size={15} />
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setShowBilling(true)}
          className="w-9 h-9 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-600 flex items-center justify-center transition border border-amber-200 cursor-pointer"
          title="Billing & Quota"
        >
          <Coins size={16} />
        </button>

        <div
          onClick={() => setShowBilling(true)}
          className="relative shrink-0 cursor-pointer"
          title={userData?.name || "Profile"}
        >
          {userData?.avatar && !imageError ? (
            <img
              className='w-9 h-9 rounded-xl object-cover border border-slate-200'
              src={userData.avatar}
              alt="Avatar"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className='w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center'>
              <User size={16} className="text-slate-500" />
            </div>
          )}
        </div>

        <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
      </div>
    )
  }

  // Expanded View
  return (
    <>
      {/* Mobile Hamburger Toggle Button */}
      <button
        className='lg:hidden fixed top-3 left-4 z-50 flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs transition cursor-pointer'
        onClick={() => setMobileOpen(true)}
      >
        <Menu size={16} />
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className='lg:hidden fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs'
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[270px] h-screen shrink-0 bg-white border-r border-slate-200 transition-transform duration-200 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className='flex items-center justify-between px-4 py-3.5 border-b border-slate-200/80 bg-[#fafbfe]'>
          <div className='flex items-center gap-2.5 min-w-0'>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-xs shrink-0 text-white font-bold text-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className='text-[15px] font-bold text-slate-900 tracking-tight truncate'>
              Nexora
            </span>
            <span className='text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full uppercase tracking-wider'>
              {userData?.plan || "free"}
            </span>
          </div>

          <button
            onClick={() => setCollapsed(true)}
            className='hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition bg-transparent border-none cursor-pointer'
            title="Collapse Sidebar"
          >
            <PanelLeftClose size={16} />
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition bg-transparent border-none cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* New Chat Primary Action */}
        <div className='px-3.5 pt-3 pb-1'>
          <button
            className='w-full flex items-center justify-center gap-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl py-2.5 border-none cursor-pointer shadow-xs transition'
            onClick={() => {
              dispatch(setSelectedConversation(null))
              dispatch(setActiveAgent("auto"))
              if (mobileOpen) setMobileOpen(false)
            }}
          >
            <Plus size={15} />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Middle Scrollable Section: Specialized Agents & Recent Chats */}
        <div className='flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-4'>
          {/* Specialized Agents Quick List */}
          <div>
            <div className='px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between'>
              <span>AI Agents</span>
              <span className='text-[9px] text-indigo-600 font-medium'>Dynamic</span>
            </div>
            <div className='space-y-0.5'>
              {agentsList.map((agent) => {
                const active = isAgentActive(agent.id)
                const Icon = agent.icon
                return (
                  <button
                    key={agent.id}
                    onClick={() => dispatch(setActiveAgent(agent.id))}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border transition text-xs cursor-pointer ${
                      active
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold shadow-2xs"
                        : "bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className='flex items-center gap-2.5 min-w-0'>
                      <Icon size={14} className={active ? "text-indigo-600" : "text-slate-500"} />
                      <span className='text-[12px] truncate'>{agent.name}</span>
                    </div>
                    {active && (
                      <span className='text-[9px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded-md flex items-center gap-1'>
                        <span className='w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse' />
                        Active
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recent Conversations */}
          <div>
            <div className='px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400'>
              Recent Conversations
            </div>

            {conversations.length === 0 ? (
              <div className='px-2 py-3 text-[11px] text-slate-400 italic'>
                No previous conversations
              </div>
            ) : (
              <div className='space-y-0.5'>
                {conversations.map((conv, i) => {
                  const isActive = selectedConversation?._id === conv?._id
                  return (
                    <div
                      key={conv?._id || `conv-${i}`}
                      onClick={() => {
                        dispatch(setSelectedConversation(conv))
                        if (mobileOpen) setMobileOpen(false)
                      }}
                      className={`flex items-center gap-2.5 cursor-pointer px-2.5 py-2 rounded-xl border transition text-xs ${
                        isActive
                          ? "bg-slate-100 border-slate-200 text-slate-900 shadow-2xs font-semibold"
                          : "bg-transparent border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60"
                      }`}
                    >
                      <MessageSquare
                        size={14}
                        className={isActive ? "text-indigo-600" : "text-slate-400"}
                      />
                      <span className='truncate text-[12.5px] flex-1'>
                        {conv?.title || "New Chat"}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Profile & Billing Bar */}
        <div className='p-3 border-t border-slate-200 bg-[#fafbfe]'>
          {userData ? (
            <div className='flex items-center gap-2.5 rounded-xl p-2 bg-white border border-slate-200 shadow-2xs'>
              <div
                onClick={() => setShowBilling(true)}
                className='relative shrink-0 cursor-pointer'
              >
                {userData?.avatar && !imageError ? (
                  <img
                    className='w-8 h-8 rounded-lg object-cover border border-slate-200'
                    src={userData.avatar}
                    alt="User Avatar"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className='w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center'>
                    <User size={15} className="text-slate-500" />
                  </div>
                )}
              </div>

              <div
                onClick={() => setShowBilling(true)}
                className='flex-1 min-w-0 cursor-pointer'
              >
                <p className='text-xs font-semibold text-slate-800 truncate'>{userData?.name || "Account"}</p>
                <p className='text-[10px] text-indigo-600 flex items-center gap-1 font-mono font-medium'>
                  <span>{userData?.credits !== undefined ? userData.credits : 50} credits</span>
                </p>
              </div>

              <div className='flex items-center gap-1 shrink-0'>
                <button
                  onClick={() => setShowBilling(true)}
                  className='p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition border-none bg-transparent cursor-pointer'
                  title="Manage Subscription & Credits"
                >
                  <Coins size={15} />
                </button>
                <button
                  onClick={() => {
                    logOut()
                    dispatch(setUserdata(null))
                  }}
                  className='p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition border-none bg-transparent cursor-pointer'
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <button className='w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl py-2 cursor-pointer transition shadow-2xs'>
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Subscription Drawer Modal */}
      <BillingDrawer open={showBilling} onClose={() => setShowBilling(false)} />
    </>
  )
}

export default SideBar

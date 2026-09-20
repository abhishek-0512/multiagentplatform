import React, { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import MessageBubble from './MessageBubble'
import LoadingAnimation from './LoadingAnimation'
import { Code2, FileText, Globe, ImageIcon, MessageSquare, Presentation, Sparkles, Zap } from 'lucide-react'

function MessageList() {
    const { selectedConversation } = useSelector(state => state.conversation)
    const { messages, isLoading } = useSelector(state => state.message)
    const bottomRef = useRef(null)

    useEffect(() => {
        requestAnimationFrame(() => {
            bottomRef?.current?.scrollIntoView({
                behavior: "smooth",
                block: "end"
            })
        })
    }, [messages?.length, isLoading])

    const quickStarters = [
        { icon: Code2, label: "Code App", prompt: "Create a modern responsive Kanban task board in HTML, CSS and JavaScript", color: "text-blue-600 border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300" },
        { icon: Presentation, label: "Make Slides", prompt: "Create a 6-slide deck on AI Agents & Autonomous Multiagent Systems", color: "text-purple-600 border-slate-200 bg-white hover:bg-slate-50 hover:border-purple-300" },
        { icon: FileText, label: "Publish PDF", prompt: "Generate a technical report on Redis Architecture, Clustering and TTL caching", color: "text-amber-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-amber-300" },
        { icon: ImageIcon, label: "Generate Visual", prompt: "Generate a realistic, high-definition photo of an innovative AI workspace", color: "text-rose-600 border-slate-200 bg-white hover:bg-slate-50 hover:border-rose-300" },
        { icon: Globe, label: "Web Search", prompt: "What are the latest breakthroughs in multi-agent orchestration systems?", color: "text-emerald-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-300" }
    ]

    return (
        <div className='flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5 bg-[#f8fafc] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            {messages.length === 0 || !selectedConversation ? (
                <div className="h-full min-h-[440px] flex flex-col items-center justify-center gap-7 text-center max-w-xl mx-auto select-none">
                    {/* Brand Banner */}
                    <div className='flex flex-col items-center gap-2.5'>
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-indigo-600">
                            <Sparkles size={22} />
                        </div>
                        <h1 className='text-2xl md:text-3xl font-bold text-slate-900 tracking-tight'>
                            What are you working on?
                        </h1>
                        <p className='text-xs md:text-sm text-slate-500 max-w-md leading-relaxed'>
                            Nexora is your collaborative workspace to research, code, analyze documents, design slides, and generate PDF reports.
                        </p>
                    </div>

                    {/* Quick Action Prompt Chips */}
                    <div className='flex flex-wrap justify-center gap-2.5 max-w-lg'>
                        {quickStarters.map((qs, idx) => {
                            const Icon = qs.icon
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        const textarea = document.querySelector('textarea')
                                        if (textarea) {
                                            textarea.value = qs.prompt
                                            textarea.dispatchEvent(new Event('input', { bubbles: true }))
                                            textarea.focus()
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer shadow-2xs ${qs.color}`}
                                >
                                    <Icon size={14} />
                                    <span>{qs.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className='space-y-4 max-w-4xl mx-auto'>
                    {messages.map((msg, i) => (
                        <div key={msg?._id || `msg-${i}`}>
                            <MessageBubble
                                role={msg?.role}
                                agent={msg?.agent}
                                content={msg?.content}
                                images={msg?.images || []}
                                artifacts={msg?.artifacts || []}
                                sources={msg?.sources || []}
                            />
                        </div>
                    ))}

                    {isLoading && <LoadingAnimation />}
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    )
}

export default MessageList

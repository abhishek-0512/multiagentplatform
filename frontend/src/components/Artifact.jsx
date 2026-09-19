import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Code2, PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { AnimatePresence, motion } from "motion/react"

function PanelContent({
  collapsed,
  setCollapsed,
  currentArtifact,
  onClose,
  children
}) {
  if (collapsed) {
    return (
      <div className='hidden lg:flex h-full border-l border-white/[0.06] bg-[#0d0f14] flex-col items-center py-4 gap-3 shrink-0 w-12'>
        <button
          className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
          onClick={() => setCollapsed(false)}
        >
          <PanelRightOpen size={16} />
        </button>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <div
            className='text-[10px] font-medium text-slate-600 tracking-widest uppercase whitespace-nowrap'
            style={{
              writingMode: "vertical-lr",
              transform: "rotate(180deg)"
            }}
          >
            {currentArtifact?.title}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col h-full bg-[#0d0f14]'>
      {/* Header */}
      <div className='h-14 px-4 border-b border-white/[0.06] flex items-center gap-3 shrink-0'>
        <button
          className='flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors duration-150 bg-transparent border-none cursor-pointer shrink-0'
          onClick={onClose ?? (() => setCollapsed(true))}
        >
          {onClose ? <X size={15} /> : <PanelRightClose size={16} />}
        </button>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <div className='flex items-center justify-center w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 shrink-0'>
            <Code2 className="text-indigo-400" size={12} />
          </div>
          <div className='text-[13px] font-medium text-slate-200 truncate'>
            {currentArtifact?.title || "Artifact"}
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className='flex-1 overflow-hidden relative'>
        {children}
      </div>
    </div>
  )
}

function Artifact() {
  const [collapsed, setCollapsed] = useState(false)
  const { artifacts } = useSelector(state => state.message)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!artifacts || artifacts.length === 0) return null

  const currentArtifact = artifacts[0]

  const panelProps = {
    collapsed,
    setCollapsed,
    currentArtifact
  }

  return (
    <>
      {/* Mobile Floating Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-24 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-medium shadow-lg shadow-indigo-500/20 border-none cursor-pointer transition-colors duration-150"
      >
        <Code2 size={13} />
        View Code
      </button>

      {/* Mobile Modal Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="lg:hidden fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[420px] border-l border-white/[0.06] overflow-hidden"
            >
              <PanelContent {...panelProps} onClose={() => setMobileOpen(false)}>
                <div className="p-4 text-slate-400 text-sm">Artifact content</div>
              </PanelContent>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Panel */}
      <motion.div
        initial={{ width: 400 }}
        animate={{ width: collapsed ? 48 : 400 }}
        transition={{
          duration: 0.25,
          ease: "easeInOut"
        }}
        className='hidden lg:flex h-full border-l border-white/[0.06] flex-col overflow-hidden shrink-0'
      >
        <PanelContent {...panelProps}>
          <div className="p-4 text-slate-400 text-sm">Artifact content</div>
        </PanelContent>
      </motion.div>
    </>
  )
}

export default Artifact

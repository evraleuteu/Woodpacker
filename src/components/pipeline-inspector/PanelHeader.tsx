'use client'

import { ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'

interface PanelHeaderProps {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  isOpen: boolean
  onToggle: () => void
}

export function PanelHeader({ label, icon: Icon, isOpen, onToggle }: PanelHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-[rgba(250,248,245,0.02)] transition-colors"
      aria-expanded={isOpen}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center">
          <Icon size={16} className="text-white" />
        </div>
        <span className="font-medium text-[#FAF8F5]">{label}</span>
      </div>
      <motion.div
        initial={{ rotate: -90 }}
        animate={{ rotate: isOpen ? 0 : -90 }}
        transition={{ duration: 0.2 }}
        className="text-[#A8A29E]"
      >
        <ChevronDown size={20} />
      </motion.div>
    </button>
  )
}
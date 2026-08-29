'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { forwardRef, ReactNode } from 'react'
import { PanelHeader } from './PanelHeader'

interface CollapsiblePanelProps {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

export const CollapsiblePanel = forwardRef<HTMLDivElement, CollapsiblePanelProps>(
  ({ label, icon: Icon, isOpen, onToggle, children }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] overflow-hidden"
      >
        <PanelHeader label={label} icon={Icon} isOpen={isOpen} onToggle={onToggle} />
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="border-t border-[rgba(250,248,245,0.06)] p-4 md:p-6"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }
)

CollapsiblePanel.displayName = 'CollapsiblePanel'
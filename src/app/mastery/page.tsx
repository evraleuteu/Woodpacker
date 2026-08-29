'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Languages, Mic, Crosshair } from 'lucide-react'
import { LanguageMastery } from '@/components/mastery/LanguageMastery'
import { SpeakingMastery } from '@/components/mastery/SpeakingMastery'
import { AccentMastery } from '@/components/mastery/AccentMastery'

const tabs = [
  { id: 'language', label: 'Language', icon: Languages },
  { id: 'speaking', label: 'Speaking', icon: Mic },
  { id: 'accent', label: 'Accent', icon: Crosshair },
] as const

type TabId = (typeof tabs)[number]['id']

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function MasteryPage() {
  const [tab, setTab] = useState<TabId>('language')

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-center gap-1 mb-6 w-fit rounded-xl p-1 bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-gradient-to-r from-[#059669] to-[#10B981] text-white'
                : 'text-[#6B7280] hover:text-[#FAF8F5]'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </motion.div>

      <div className={tab === 'language' ? '' : 'hidden'}>
        <LanguageMastery />
      </div>
      <div className={tab === 'speaking' ? '' : 'hidden'}>
        <SpeakingMastery />
      </div>
      <div className={tab === 'accent' ? '' : 'hidden'}>
        <AccentMastery />
      </div>
    </div>
  )
}
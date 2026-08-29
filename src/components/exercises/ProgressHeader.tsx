'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Flame, Trophy, Sparkles } from 'lucide-react'
import type { GameStats, Badge } from '@/lib/types/exercise'

interface ProgressHeaderProps {
  stats: GameStats
  badges: Badge[]
  onBadgeClick?: (badge: Badge) => void
}

function StreakFlame({ streak }: { streak: number }) {
  return (
    <motion.div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.25)]"
      animate={streak > 0 ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 1.6, repeat: streak > 0 ? Infinity : 0, ease: 'easeInOut' }}
    >
      <Flame size={16} className="text-[#F59E0B]" />
      <span className="text-sm font-bold text-[#FAF8F5]">{streak}</span>
    </motion.div>
  )
}

function XpValue({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  useEffect(() => {
    let raf: number
    const start = displayRef.current
    const delta = value - start
    if (delta === 0) return
    const duration = 650
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const next = Math.round(start + delta * (1 - Math.pow(1 - p, 2)))
      displayRef.current = next
      setDisplay(next)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className="text-sm font-bold text-[#FAF8F5]">{display} XP</span>
}

/** Top bar: XP, streak, daily goal progress. */
export function ProgressHeader({ stats, badges, onBadgeClick }: ProgressHeaderProps) {
  const goalTarget = stats.dailyGoal
  const pct = Math.min(100, (stats.goalProgress / Math.max(1, goalTarget)) * 100)
  const levelLabel = `Level ${stats.level}`

  return (
    <motion.header
      className="flex items-center justify-between gap-4 px-1 py-2 mb-2"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.2)]">
          <Trophy size={16} className="text-[#10B981]" />
          <span className="text-sm font-bold text-[#FAF8F5]">{levelLabel}</span>
        </div>
        <StreakFlame streak={stats.streak} />
      </div>

      <div className="flex-1 max-w-md">
        <div className="flex items-center justify-between mb-1">
          <XpValue value={stats.xp} />
          <span className="text-[10px] text-[#6B7280] font-medium">{levelLabel} goal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-[rgba(250,248,245,0.06)] overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#84CC16] to-[#10B981] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <span className="text-[10px] text-[#6B7280] font-medium whitespace-nowrap">
            {stats.goalProgress}/{goalTarget}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {badges.slice(0, 3).map((b) => (
          <motion.button
            key={b.id}
            onClick={() => onBadgeClick?.(b)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-accent-lime)] ${
              b.earned
                ? 'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white border-transparent'
                : 'bg-[rgba(250,248,245,0.03)] text-[#6B7280] border-[rgba(250,248,245,0.08)]'
            }`}
            title={b.label}
            aria-label={b.label}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <BadgeIcon icon={b.icon} />
          </motion.button>
        ))}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#FAF8F5] transition-colors cursor-pointer">
          <Sparkles size={15} />
        </div>
      </div>
    </motion.header>
  )
}

function BadgeIcon({ icon }: { icon: string }) {
  const map: Record<string, React.ReactNode> = {
    sparkles: <Sparkles size={14} />,
    flame: <Flame size={14} />,
    trophy: <Trophy size={14} />,
    'book-open': <BookOpenIcon />,
    'book-marked': <BookMarkedIcon />,
    headphones: <HeadphonesIcon />,
    mic: <MicIcon />,
  }
  return <>{map[icon] ?? <Sparkles size={14} />}</>
}

function BookOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a4 4 0 0 0 4 4h6z" />
    </svg>
  )
}
function BookMarkedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 2 17.5V8a2 2 0 0 1 2-2h4.5a1 1 0 0 1 .8.4l1.2 1.8a1 1 0 0 0 .8.4H20a2 2 0 0 1 2 2v8.5a2.5 2.5 0 0 1-2.5 2.5z" />
      <path d="M10 4.5h4a1.5 1.5 0 0 1 1.5 1.5v1" />
    </svg>
  )
}
function HeadphonesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 4-2 5-2 9h16c0-4-2-5-2-9" />
      <path d="M13.73 15a3.5 3.5 0 1 1-7.46 0C6 15 6 13.8 6 13h12c0 .8 0 2-.27 2" />
      <circle cx="18" cy="16" r="2" />
      <circle cx="6" cy="16" r="2" />
    </svg>
  )
}
function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="18" x2="12" y2="23" />
    </svg>
  )
}

'use client'

import { motion } from 'framer-motion'
import type { AvatarEmotion } from '@/lib/types/exercise'
import type { ReactElement } from 'react'

interface AvatarProps {
  emotion?: AvatarEmotion
  size?: number
  className?: string
}

const WingOffset: Record<AvatarEmotion, { rotate: number; y: number }> = {
  idle: { rotate: 0, y: 0 },
  happy: { rotate: -5, y: -2 },
  thinking: { rotate: 5, y: 0 },
  encourage: { rotate: -3, y: 0 },
  correct: { rotate: 0, y: 0 },
  wrong: { rotate: 8, y: 0 },
  celebrate: { rotate: -25, y: 12 },
}

export function Avatar({ emotion = 'idle', size = 120, className = '' }: AvatarProps) {
  const wing = WingOffset[emotion]
  return (
    <motion.div
      className={`avatar-wrap inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-label={`Mascot, looking ${emotion}`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="a-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#059669" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="a-beak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
          <linearGradient id="a-accent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A855F7" />
            <stop offset="1" stopColor="#84CC16" />
          </linearGradient>
          <filter id="a-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="colored" />
            <feMerge>
              <feMergeNode in="colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="60" cy="104" rx="14" ry="5" fill="rgba(0,0,0,0.18)" />
        <ellipse cx="60" cy="78" rx="22" ry="26" fill="url(#a-body)" />
        <motion.path
          d="M48 76 C42 70 40 82 48 84 C44 86 46 94 54 90"
          fill="url(#a-body)"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
          style={{ transformOrigin: '54px 82px' }}
          animate={{ rotate: wing.rotate, y: wing.y }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        />
        <circle cx="60" cy="50" r="18" fill="url(#a-body)" />
        <circle cx="60" cy="50" r="18" fill="url(#a-body)" filter="url(#a-glow)" />

        {/* Crest — shown on celebration / correct */}
        {emotion === 'celebrate' || emotion === 'correct' ? (
          <path
            d="M52 40 C56 34 64 34 68 40 C64 38 56 38 52 40 Z"
            fill="url(#a-accent)"
          />
        ) : null}

        {Eyes[emotion]}
        {Beak[emotion]}

        <rect x="52" y="100" width="4" height="6" rx="2" fill="#D97706" />
        <rect x="64" y="100" width="4" height="6" rx="2" fill="#D97706" />
      </svg>
    </motion.div>
  )
}

const Eyes: Record<AvatarEmotion, ReactElement> = {
  idle: (
    <>
      <circle cx="53" cy="48" r="3.2" fill="#0F172A" />
      <circle cx="67" cy="48" r="3.2" fill="#0F172A" />
    </>
  ),
  happy: (
    <>
      <circle cx="53" cy="46" r="3.4" fill="#0F172A" />
      <circle cx="67" cy="46" r="3.4" fill="#0F172A" />
      <path d="M50 56 C53 58 57 58 60 56" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  thinking: (
    <>
      <path d="M51 50 C55 54 65 54 69 50" stroke="#0F172A" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </>
  ),
  encourage: (
    <>
      <circle cx="53" cy="49" r="3" fill="#0F172A" />
      <circle cx="67" cy="49" r="3" fill="#0F172A" />
    </>
  ),
  correct: (
    <>
      <circle cx="53" cy="46" r="3.2" fill="#0F172A" />
      <circle cx="67" cy="46" r="3.2" fill="#0F172A" />
      <path d="M50 56 C53 58 57 58 60 56" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  wrong: (
    <>
      <circle cx="53" cy="52" r="2.6" fill="#EF4444" />
      <circle cx="67" cy="52" r="2.6" fill="#EF4444" />
      <line x1="56" y1="46" x2="64" y2="58" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  celebrate: (
    <>
      <circle cx="53" cy="44" r="2.8" fill="#0F172A" />
      <circle cx="67" cy="44" r="2.8" fill="#0F172A" />
      <path d="M50 56 C53 59 57 59 60 56" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="60" cy="64" r="1.6" fill="#F59E0B" />
    </>
  ),
}

const Beak: Record<AvatarEmotion, ReactElement> = {
  idle: <BeakPath d="M58 57 L62 57 C63 57 63.8 58 63 59 C62 60 58 60 58 58 C58 57.5 58 57 58 57 Z" />,
  happy: <BeakPath d="M58 58 L62 58 C63.2 58 64 58.8 63.2 59.8 C62.4 60.8 57.6 60.8 57 59.8 C56.2 58.8 57 58 58 58 Z" />,
  thinking: <BeakPath d="M60 58 C62 58 62.8 59 62 60 C61.2 61 59 61 58 60 C57.2 59 58 58 60 58 Z" />,
  encourage: <BeakPath d="M59 57 L61 57 C62 57 62.6 57.8 62 58.6 C61.4 59.4 58.6 59.4 58 58.6 C57.4 57.8 58 57 59 57 Z" />,
  correct: <BeakPath d="M58 58 L62 58 C63.2 58 64 58.8 63.2 59.8 C62.4 60.8 57.6 60.8 57 59.8 C56.2 58.8 57 58 58 58 Z" />,
  wrong: <BeakPath d="M58 59 L62 59 C63.2 59 64 59.8 63.2 60.8 C62.4 61.8 57.6 61.8 57 60.8 C56.2 59.8 57 59 58 59 Z" />,
  celebrate: <BeakPath d="M58 59 L62 59 C64 59 65 60 64 61.5 C63 63 59 63 58 61.5 C57 60 58 59 58 59 Z" />,
}

function BeakPath({ d }: { d: string }) {
  return <path d={d} fill="url(#a-beak)" stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
}

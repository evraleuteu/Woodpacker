'use client'

import { useEffect, useState } from 'react'

interface ConfettiProps {
  /** number of particles */
  count?: number
  /** duration in ms before self-removing */
  duration?: number
}

const COLORS = ['#A855F7', '#84CC16', '#10B981', '#38BDF8', '#F59E0B', '#EF4444']

interface Particle {
  id: number
  left: number
  size: number
  color: string
  delay: number
  dur: number
  rotation: number
  rounded: boolean
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: (id / count) * 100 + (Math.random() - 0.5) * 4,
    size: Math.random() * 5 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.6,
    dur: 1.4 + Math.random() * 1.2,
    rotation: Math.random() * 360,
    rounded: Math.random() < 0.5,
  }))
}

/** A lightweight CSS-only confetti burst anchored to the viewport. */
export function Confetti({ count = 60, duration = 2200 }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>(() => createParticles(count))

  useEffect(() => {
    const t = setTimeout(() => setParticles([]), duration)
    return () => clearTimeout(t)
  }, [duration, setParticles])

  if (!particles.length) return null

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-[-10px] w-2 h-2 opacity-90"
          style={{
            left: `${p.left}vw`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.rounded ? '50%' : '0',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.dur}s cubic-bezier(0.34, 0, 0.5, 1) ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

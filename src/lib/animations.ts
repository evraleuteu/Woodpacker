import { type Variants, type TargetAndTransition } from 'framer-motion'

/** Shared Framer Motion variants for the premium exercise layer. */

export const cardEntrance: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: -12,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
}

export const successBounce: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.12, 1],
    transition: { duration: 0.45, type: 'spring', stiffness: 400, damping: 16 },
  },
}

export const chipFly: TargetAndTransition = {
  scale: [1, 1.1, 1],
  rotate: [0, -4, 0],
  transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 12,
    transition: { duration: 0.18, ease: 'easeInOut' },
  },
}

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: -30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.25, type: 'spring', stiffness: 500, damping: 22 },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: { duration: 0.18 },
  },
}

export const positiveMessages = ['Excellent!', 'Perfect!', 'Nice work!', 'You got it!', 'Awesome!', 'Nailed it!', 'Keep going!']

export function randomPositive(): string {
  return positiveMessages[Math.floor(Math.random() * positiveMessages.length)]
}

export function emitConfetti(container: HTMLElement, count = 60): void {
  const colors = ['#A855F7', '#84CC16', '#10B981', '#38BDF8', '#F59E0B']
  const rect = container.getBoundingClientRect()
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    const size = Math.random() * 10 + 6
    const color = colors[Math.floor(Math.random() * colors.length)]
    const left = Math.random() * rect.width
    const delay = Math.random() * 0.6
    el.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'left:' + left + 'px',
      'top:-10px',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'background:' + color,
      'border-radius:' + (Math.random() < 0.5 ? '50%' : '0'),
      'opacity:0.9',
      'transform:rotate(' + (Math.random() * 360) + 'deg)',
      'animation:confetti-fall ' + (2 + Math.random()) + 's linear ' + delay + 's forwards',
      'z-index:1',
    ].join(';')
    container.style.position = 'relative'
    container.appendChild(el)
    window.setTimeout(() => el.remove(), 3000)
  }
}

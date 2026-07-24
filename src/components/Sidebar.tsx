'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Home', icon: '◈' },
  { href: '/dashboard', label: 'Dashboard', icon: '☰' },
  { href: '/upload', label: 'Upload', icon: '↑' },
  { href: '/materials', label: 'Materials', icon: '📚' },
  { href: '/speaking', label: 'Speaking', icon: '🎤' },
  { href: '/cycles', label: 'Cycles', icon: '⟳' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } min-h-screen bg-surface border-r border-border transition-all duration-200 flex flex-col shrink-0`}
    >
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <Link href="/" className="text-lg font-bold tracking-tight">
            <span className="text-wood-400">Woodpecker</span>{' '}
            <span className="text-muted">AI</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted hover:text-foreground transition-colors p-1"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-wood-600/20 text-wood-400 border border-wood-600/30'
                  : 'text-muted hover:text-foreground hover:bg-surface-lighter'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-lg w-6 text-center shrink-0">{item.icon}</span>
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-wood-600 flex items-center justify-center text-xs font-bold">
              U
            </div>
            <div className="text-xs">
              <div className="font-medium text-foreground">User</div>
              <div className="text-muted">Free Plan</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
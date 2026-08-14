'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Languages,
  Mic,
  Crosshair,
  Upload,
  BookOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Map,
  Home,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const pillarItems = [
  { href: '/language', label: 'Language Mastery', icon: Languages },
  { href: '/speaking', label: 'Speaking Mastery', icon: Mic },
  { href: '/accent', label: 'Accent Mastery', icon: Crosshair },
]

const toolItems = [
  { href: '/onboarding', label: 'Start Journey', icon: Map },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/materials', label: 'Materials', icon: BookOpen },
  { href: '/cycles', label: 'Cycles', icon: RefreshCw },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-56'
      } min-h-screen glass border-r border-[rgba(250,248,245,0.06)] transition-all duration-200 flex flex-col shrink-0 relative z-10`}
    >
      <div className="p-4 border-b border-[rgba(250,248,245,0.06)] flex items-center justify-between h-14">
        {!collapsed && (
          <Link href="/" className="text-base font-bold tracking-tight flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">W</span>
            </div>
            <span className="text-gradient">Woodpecker</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center mx-auto">
            <span className="text-[10px] text-white font-bold">W</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[#6B7280] hover:text-[#FAF8F5] transition-colors p-1 rounded-md hover:bg-[rgba(250,248,245,0.03)]"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-1 py-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all ${
              isActive(item.href)
                ? 'bg-gradient-to-r from-[rgba(16,185,129,0.12)] to-[rgba(5,150,105,0.08)] text-[#FAF8F5] border border-[rgba(16,185,129,0.25)]'
                : 'text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.03)]'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}

        {!collapsed && (
          <div className="px-4 pt-4 pb-1 flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-gradient-to-r from-[#059669] to-[#10B981]" />
            <div className="text-[10px] uppercase tracking-[0.15em] text-[rgba(250,248,245,0.3)] font-semibold">
              Pillars
            </div>
          </div>
        )}
        {pillarItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all ${
              isActive(item.href)
                ? 'bg-gradient-to-r from-[rgba(16,185,129,0.12)] to-[rgba(5,150,105,0.08)] text-[#FAF8F5] border border-[rgba(16,185,129,0.25)]'
                : 'text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.03)]'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}

        {!collapsed && (
          <div className="px-4 pt-4 pb-1 flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]" />
            <div className="text-[10px] uppercase tracking-[0.15em] text-[rgba(250,248,245,0.3)] font-semibold">
              Tools
            </div>
          </div>
        )}
        {toolItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-lg transition-all ${
              isActive(item.href)
                ? 'bg-gradient-to-r from-[rgba(16,185,129,0.12)] to-[rgba(5,150,105,0.08)] text-[#FAF8F5] border border-[rgba(16,185,129,0.25)]'
                : 'text-[#6B7280] hover:text-[#FAF8F5] hover:bg-[rgba(250,248,245,0.03)]'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={16} className="shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-[rgba(250,248,245,0.06)]">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center text-[10px] font-bold shrink-0">
              U
            </div>
            <div className="text-xs flex-1 min-w-0">
              <div className="font-medium text-[#FAF8F5] truncate">Learner</div>
              <div className="text-[#6B7280]">Level: Beginner</div>
            </div>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#059669] to-[#10B981] flex items-center justify-center text-[10px] font-bold mx-auto">
            U
          </div>
        )}
      </div>
    </aside>
  )
}

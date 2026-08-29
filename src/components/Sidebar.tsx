'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Home,
  BookOpen,
  BarChart3,
  Network,
  Mic2,
  Library,
  Sparkles,
  FileQuestion,
  Layers,
  Settings,
  HelpCircle,
  Bug,
  ScanText,
  Blocks,
  FileText,
  Cloud,
} from 'lucide-react'
import CourseSwitcher from '@/components/CourseSwitcher'

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload Center', icon: Upload },
  { href: '/materials', label: 'Library', icon: Library },
]

const learnNav = [
  { href: '/cycles', label: 'Practice Cycles', icon: RefreshCw },
  { href: '/exercises', label: 'Exercises', icon: FileQuestion },
  { href: '/mastery', label: 'Mastery', icon: Layers },
  { href: '/speaking', label: 'Speaking', icon: Mic2 },
]

const insightsNav = [
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/knowledge-graph', label: 'Knowledge Graph', icon: Network },
  { href: '/extraction-comparison', label: 'Extraction Comparison', icon: ScanText },
]

const secondaryNav = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/pricing', label: 'Pricing', icon: Sparkles },
]

const extractionInspectorsNav = [
  { href: '/developer/pymupdf', label: 'PyMuPDF', icon: FileText, badge: ':8003' },
  { href: '/developer/surya', label: 'Surya', icon: ScanText, badge: ':8004' },
  { href: '/developer/pp-structure', label: 'PP-Structure', icon: Layers, badge: ':8005' },
  { href: '/developer/docling', label: 'Docling', icon: Blocks, badge: ':8002' },
  { href: '/developer/llm-vision', label: 'LLM+Vision', icon: Sparkles, badge: ':8001' },
  { href: '/developer/google-docai', label: 'Google Doc AI', icon: Cloud, badge: ':8006' },
]

const developerNav = [
  { href: '/developer/pipeline-inspector', label: 'Pipeline Inspector', icon: Bug },
  { href: '/developer/exercise-inspector', label: 'Exercise Inspector', icon: FileQuestion },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    const base = href.split('?')[0]
    return pathname === base || pathname.startsWith(base + '/')
  }

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) => {
    const active = isActive(href)
    return (
      <Link
        href={href}
        className={`mx-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
          active
            ? 'border border-[#BBF7D0] bg-[#F0FDF4] text-[#1F7A4C]'
            : 'border border-transparent text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
        }`}
        title={collapsed ? label : undefined}
      >
        <Icon size={17} className={active ? 'text-[#1F7A4C]' : 'text-[#9CA3AF]'} />
        {!collapsed && <span>{label}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={`${
        collapsed ? 'w-[72px]' : 'w-[256px]'
      } h-screen bg-white border-r border-[#E5E7EB] transition-all duration-200 flex flex-col shrink-0 relative z-20`}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="h-[64px] px-4 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1F7A4C] flex items-center justify-center shrink-0">
              <BookOpen size={15} className="text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
              Woodpacker
            </span>
          </Link>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-[#1F7A4C] flex items-center justify-center mx-auto">
            <BookOpen size={16} className="text-white" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-7 h-7 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB] flex items-center justify-center transition-colors shrink-0"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Course switcher */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-[#F3F4F6]">
          <CourseSwitcher />
        </div>
      )}

      <nav className="flex-1 py-4 space-y-5 overflow-y-auto">
        {/* Primary */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-4 pb-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Workspace</span>
            </div>
          )}
          {primaryNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        {/* Learn */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-4 pb-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Learn</span>
            </div>
          )}
          {learnNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        {/* Insights */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-4 pb-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Insights</span>
            </div>
          )}
          {insightsNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        {/* Extraction Inspectors — 6 independent benchmarks (stateless, per-port) */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-4 pb-2 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#10B981]" />
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Extraction Inspectors</span>
            </div>
          )}
          {extractionInspectorsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mx-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
                isActive(item.href)
                  ? 'border border-[#BBF7D0] bg-[#F0FDF4] text-[#1F7A4C]'
                  : 'border border-transparent text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]'
              }`}
              title={collapsed ? `${item.label} ${item.badge}` : undefined}
            >
              <item.icon size={17} className={isActive(item.href) ? 'text-[#1F7A4C]' : 'text-[#9CA3AF]'} />
              {!collapsed && (
                <span className="flex-1 flex items-center justify-between">
                  <span>{item.label}</span>
                  <span className="text-[10px] font-mono text-[#9CA3AF] bg-[#F3F4F6] border border-[#E5E7EB] rounded px-1 py-0.5">{item.badge}</span>
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Developer – tooling (pipeline + stored artifacts) */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-4 pb-2 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[#6B7280]" />
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Developer Tools</span>
            </div>
          )}
          {developerNav.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        {/* Secondary - collapsed shows only if not collapsed for cleanliness */}
        {!collapsed && (
          <div className="space-y-1 pt-2 border-t border-[#F3F4F6] mx-3">
            <div className="px-1 pb-2 pt-2">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-[#9CA3AF] uppercase">Discover</span>
            </div>
            {secondaryNav.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-[#E5E7EB] space-y-2">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#F9FAFB] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-xs font-bold text-[#1F7A4C] shrink-0">
                L
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold text-[#111827] truncate">Learner</div>
                <div className="text-xs text-[#6B7280]">Free plan</div>
              </div>
              <Link href="/settings" className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]">
                <Settings size={14} />
              </Link>
            </div>
            <Link href="/help" className="hidden">
              <HelpCircle size={14} /> Help
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-xs font-bold text-[#1F7A4C]">
              L
            </div>
            <Link href="/settings" className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center text-[#6B7280]">
              <Settings size={14} />
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}

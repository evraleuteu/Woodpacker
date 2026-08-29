'use client'

import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#E5E7EB]">
      <div className="max-w-[1200px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1F7A4C] flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
            Woodpacker
          </span>
          <span className="hidden sm:inline-flex text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[#1F7A4C] ml-1">
            Education
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link href="#features" className="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            Features
          </Link>
          <Link href="#solution" className="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            How it works
          </Link>
          <Link href="/pricing" className="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard" className="px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] rounded-lg hover:bg-[#F9FAFB] transition-colors">
            Dashboard
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden sm:inline-flex text-sm font-medium text-[#6B7280] hover:text-[#111827] px-3 py-2">
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D] transition-all shadow-sm hover:shadow-md"
          >
            Start Learning Free
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  )
}

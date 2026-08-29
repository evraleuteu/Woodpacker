'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

const MARKETING_ROUTES = ['/', '/onboarding', '/pricing']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMarketing = MARKETING_ROUTES.includes(pathname) || pathname.startsWith('/onboarding')

  if (isMarketing) {
    return <main className="flex-1 overflow-y-auto relative z-10 bg-[#FAFBFC]">{children}</main>
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10 bg-[#FAFBFC]">{children}</main>
    </>
  )
}

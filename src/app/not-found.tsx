import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md mx-auto px-6">
        <div className="text-[80px] font-bold text-gradient leading-none">404</div>
        <h1 className="text-xl font-semibold text-[#FAF8F5]">Page not found</h1>
        <p className="text-sm text-[#6B7280]">
          This page doesn&apos;t exist or may have moved. Let&apos;s get you back on track.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="btn-primary inline-flex items-center gap-2 text-sm">
            Go Home
          </Link>
          <Link href="/dashboard" className="btn-secondary inline-flex items-center gap-2 text-sm">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
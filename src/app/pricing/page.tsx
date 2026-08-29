'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, Sparkles, ArrowRight, ShieldCheck, Users, Zap, BookOpen } from 'lucide-react'
import LandingHeader from '@/components/landing/LandingHeader'

const plans = [
  {
    name: 'Free',
    price: '€0',
    period: '/month',
    desc: 'For testing the mastery system',
    cta: 'Start free',
    href: '/onboarding',
    featured: false,
    features: ['Up to 2 learning materials', 'Basic AI extraction', 'Limited exercise generation', 'Community support', 'No credit card required'],
  },
  {
    name: 'Pro',
    price: '€19',
    period: '/month',
    desc: 'For serious learners — most popular',
    cta: 'Start 14-day free trial',
    href: '/onboarding',
    featured: true,
    badge: 'Most popular',
    features: [
      'Unlimited materials (books, PDFs, audio, video)',
      'Full AI transformation & knowledge mapping',
      'Speaking & accent scoring',
      'Adaptive repetition engine (30 → 1 day)',
      'Progress analytics & retention insights',
      'AI Tutor & personalized guidance',
      'Priority support',
    ],
  },
  {
    name: 'Team',
    price: 'Custom',
    period: '',
    desc: 'For schools and institutions',
    cta: 'Contact sales',
    href: 'mailto:team@woodpacker.education',
    featured: false,
    features: ['Everything in Pro', 'Team analytics & admin panel', 'SSO & GDPR compliance', 'Volume discounts', 'Dedicated success manager', 'Onboarding & training'],
  },
]

const comparison = [
  { feature: 'Materials', free: '2', pro: 'Unlimited', team: 'Unlimited' },
  { feature: 'AI Transformation', free: 'Basic', pro: 'Full', team: 'Full + priority' },
  { feature: 'Exercise detection', free: '✓ Limited', pro: '✓ Automatic', team: '✓ Automatic' },
  { feature: 'Speaking mastery', free: '—', pro: '✓', team: '✓' },
  { feature: 'Accent scoring', free: '—', pro: '✓', team: '✓' },
  { feature: 'Adaptive repetition', free: '—', pro: '✓ 5 cycles', team: '✓ 5 cycles' },
  { feature: 'Progress analytics', free: 'Basic', pro: 'Premium', team: 'Team analytics' },
  { feature: 'AI Tutor', free: '—', pro: '✓', team: '✓' },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <LandingHeader />

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C] mb-4">
          <Sparkles size={12} /> Simple, transparent pricing
        </div>
        <h1 className="text-[40px] md:text-[48px] font-bold tracking-tight leading-[0.95] text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
          Premium learning,
          <br />
          <span className="text-[#1F7A4C]">fair pricing</span>
        </h1>
        <p className="text-[16px] leading-relaxed text-[#6B7280] max-w-2xl mx-auto mt-4">
          Start free and upgrade when you are ready to accelerate. No hidden fees. Cancel anytime.
        </p>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-[#6B7280]">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#1F7A4C]" /> 14-day trial</span>
          <span className="flex items-center gap-1.5"><Users size={14} className="text-[#1F7A4C]" /> 12k+ learners</span>
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-[#F4B942]" /> Instant setup</span>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-[1100px] mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-[24px] p-7 flex flex-col ${plan.featured ? 'bg-white border-2 border-[#1F7A4C] shadow-[0_12px_32px_rgba(31,122,76,0.12)] md:-mt-2 relative' : 'bg-white border border-[#E5E7EB]'}`}
            >
              {plan.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1F7A4C] text-white text-xs font-bold shadow-sm">
                  {plan.badge}
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>{plan.name}</span>
                {plan.featured && <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />}
              </div>
              <p className="text-sm text-[#6B7280]">{plan.desc}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{plan.price}</span>
                <span className="text-sm text-[#6B7280]">{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-[#374151] leading-snug">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${plan.featured ? 'bg-[#1F7A4C]' : 'bg-[#F9FAFB] border border-[#E5E7EB]'}`}>
                      <Check size={10} className={plan.featured ? 'text-white' : 'text-[#6B7280]'} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-6 inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all ${plan.featured ? 'bg-[#1F7A4C] text-white hover:bg-[#16643D] shadow-sm' : 'bg-white border border-[#E5E7EB] text-[#111827] hover:bg-[#F9FAFB]'}`}
              >
                {plan.cta}
                {plan.featured && <ArrowRight size={14} />}
              </Link>
              {plan.featured && <p className="text-xs text-center text-[#6B7280] mt-2">No credit card for trial · Cancel anytime</p>}
            </motion.div>
          ))}
        </div>

        {/* Trust bar */}
        <div className="mt-8 rounded-2xl border border-[#E5E7EB] bg-white p-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-[#374151]">
            <BookOpen size={16} className="text-[#1F7A4C]" />
            <span className="font-semibold">All plans include:</span>
            <span className="text-[#6B7280]">Secure cloud storage · 18 languages · Import from any textbook</span>
          </div>
          <Link href="/onboarding" className="text-sm font-semibold text-[#1F7A4C] hover:text-[#16643D] flex items-center gap-1">
            See how it works <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-[900px] mx-auto px-6 pb-16">
        <div className="rounded-[24px] border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFBFC] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111827]">Compare plans</h3>
            <span className="text-xs text-[#6B7280]">Choose what fits your journey</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-white">
                  <th className="text-left px-6 py-3 font-semibold text-[#6B7280] text-xs uppercase tracking-wide">Feature</th>
                  <th className="text-center px-4 py-3 font-bold text-[#111827]">Free</th>
                  <th className="text-center px-4 py-3 font-bold text-[#1F7A4C] bg-[#F0FDF4]">Pro</th>
                  <th className="text-center px-4 py-3 font-bold text-[#111827]">Team</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFC]'}>
                    <td className="px-6 py-3 font-medium text-[#374151] border-t border-[#F3F4F6]">{row.feature}</td>
                    <td className="text-center px-4 py-3 border-t border-[#F3F4F6] text-[#6B7280]">{row.free}</td>
                    <td className="text-center px-4 py-3 border-t border-[#F3F4F6] font-semibold text-[#1F7A4C] bg-[#F0FDF4]/50">{row.pro}</td>
                    <td className="text-center px-4 py-3 border-t border-[#F3F4F6] text-[#374151]">{row.team}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ mini */}
        <div className="mt-8 text-center">
          <h4 className="text-sm font-bold text-[#111827]">Questions?</h4>
          <p className="text-sm text-[#6B7280] mt-1">
            Contact <a href="mailto:support@woodpacker.education" className="text-[#1F7A4C] font-semibold hover:underline">support@woodpacker.education</a> or{' '}
            <Link href="/onboarding" className="text-[#1F7A4C] font-semibold hover:underline">start free</Link> to try Woodpacker with your own books.
          </p>
        </div>

        <footer className="mt-10 pt-6 border-t border-[#E5E7EB] flex items-center justify-center gap-4 text-xs text-[#6B7280]">
          <span>© 2026 Woodpacker</span>
          <Link href="/" className="hover:text-[#111827]">Home</Link>
          <Link href="/dashboard" className="hover:text-[#111827]">Dashboard</Link>
        </footer>
      </section>
    </div>
  )
}

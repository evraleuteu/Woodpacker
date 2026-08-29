'use client'

import { useState } from 'react'
import { User, Bell, Cpu, HardDrive, CreditCard, BookOpen, ShieldCheck, Globe, Moon, Volume2, Target, Save } from 'lucide-react'

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'learning', label: 'Learning Preferences', icon: BookOpen },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai', label: 'AI Settings', icon: Cpu },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
] as const

type TabId = (typeof tabs)[number]['id']

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile')
  const [minutes, setMinutes] = useState(20)

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
      <h1 className="text-[28px] font-bold tracking-tight text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
        Settings
      </h1>
      <p className="text-sm text-[#6B7280] mt-1">Modern, calm, and organized — every preference in one premium place.</p>

      <div className="mt-6 grid lg:grid-cols-[240px_1fr] gap-6">
        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-2 h-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${tab === t.id ? 'bg-[#1F7A4C] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'}`}
            >
              <t.icon size={16} className={tab === t.id ? 'text-white' : 'text-[#9CA3AF]'} />
              {t.label}
            </button>
          ))}
          <div className="mt-4 pt-4 border-t border-[#F3F4F6] px-2">
            <div className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-[#1F7A4C]" /> Secure
            </div>
            <div className="text-xs text-[#6B7280] leading-relaxed mt-1">Your data stays private. GDPR compliant cloud.</div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-6 md:p-7">
          {tab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                Profile
              </h2>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC]">
                <div className="w-14 h-14 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center text-lg font-bold text-[#1F7A4C]">L</div>
                <div>
                  <div className="text-sm font-bold text-[#111827]">Learner</div>
                  <div className="text-xs text-[#6B7280]">learner@woodpacker.local · Level: Beginner</div>
                </div>
                <button className="ml-auto px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-xs font-semibold hover:bg-[#F9FAFB]">Edit</button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Display name" defaultValue="Learner" />
                <Field label="Email" defaultValue="learner@woodpacker.local" type="email" />
                <Field label="Language" defaultValue="German" />
                <Field label="Timezone" defaultValue="Europe/Berlin" />
              </div>
              <SaveRow />
            </div>
          )}

          {tab === 'learning' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                Learning Preferences
              </h2>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5">
                <div className="text-sm font-semibold text-[#111827] flex items-center gap-2">
                  <Target size={14} className="text-[#1F7A4C]" /> Daily goal · {minutes} minutes
                </div>
                <input type="range" min={5} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full accent-[#1F7A4C] mt-3" />
                <div className="flex justify-between text-[11px] text-[#9CA3AF] mt-1">
                  <span>5 min</span>
                  <span>60</span>
                  <span>120</span>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <SelectField label="Interface language" options={['English', 'German', 'French', 'Spanish']} />
                <SelectField label="Learning level" options={['A1', 'A2', 'B1', 'B2', 'C1', 'C2']} />
                <ToggleRow label="Show translations" desc="Show hints during speaking practice" defaultChecked />
                <ToggleRow label="Auto-play audio" desc="Play pronunciation automatically" defaultChecked />
              </div>
              <SaveRow />
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                Notifications
              </h2>
              <ToggleRow label="Daily reminder" desc="Remind me to practice at 19:00" defaultChecked />
              <ToggleRow label="Streak alert" desc="Nudge when streak is at risk" defaultChecked />
              <ToggleRow label="Weekly report" desc="Send progress summary every Sunday" />
              <ToggleRow label="Product updates" desc="New features and improvements" />
              <SaveRow />
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                AI Settings
              </h2>
              <ToggleRow label="AI Tutor" desc="Enable personalized explanations and corrections" defaultChecked />
              <ToggleRow label="Smart exercise generation" desc="Generate exercises from your own material" defaultChecked />
              <SelectField label="AI model" options={['Balanced (recommended)', 'Fast', 'Thorough']} />
              <div className="rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] p-3 flex items-start gap-2">
                <Cpu size={14} className="text-[#1F7A4C] mt-0.5 shrink-0" />
                <p className="text-xs leading-relaxed text-[#16643D]">AI only uses your uploaded materials. Nothing is shared or used for training.</p>
              </div>
              <SaveRow />
            </div>
          )}

          {tab === 'storage' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                Storage
              </h2>
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] p-5">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[#111827] flex items-center gap-1.5">
                    <HardDrive size={14} className="text-[#1F7A4C]" /> Used storage
                  </span>
                  <span className="font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                    1.2 GB / 10 GB
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white border border-[#E5E7EB] overflow-hidden mt-3 p-0.5">
                  <div className="h-full rounded-full bg-[#1F7A4C]" style={{ width: '12%' }} />
                </div>
                <div className="text-xs text-[#6B7280] mt-1.5">Secure, encrypted, GDPR-compliant object storage.</div>
              </div>
              <div className="text-xs text-[#6B7280]">Manage materials in the Upload Center. Delete courses to free space.</div>
              <SaveRow />
            </div>
          )}

          {tab === 'subscription' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-[#111827]" style={{ fontFamily: 'var(--font-manrope)' }}>
                Subscription
              </h2>
              <div className="rounded-2xl border-2 border-[#1F7A4C] bg-[#F0FDF4] p-5">
                <div className="text-sm font-bold text-[#111827]">Pro plan · €19 / month</div>
                <div className="text-xs text-[#16643D] mt-1">Unlimited materials · Full AI transformation · Priority support</div>
                <div className="mt-4 flex gap-2">
                  <button className="px-4 py-2 rounded-xl bg-[#1F7A4C] text-white text-xs font-semibold">Manage billing</button>
                  <button className="px-4 py-2 rounded-xl bg-white border border-[#BBF7D0] text-xs font-semibold text-[#1F7A4C]">View invoices</button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 flex items-center justify-between">
                <span className="text-sm text-[#374151]">Need Team plan for your institution?</span>
                <a href="/pricing" className="text-xs font-semibold text-[#1F7A4C] hover:text-[#16643D]">
                  See pricing →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, defaultValue, type = 'text' }: { label: string; defaultValue: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <input type={type} defaultValue={defaultValue} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A4C]/15 focus:border-[#1F7A4C] focus:bg-white" />
    </label>
  )
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#374151]">{label}</span>
      <select className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#1F7A4C]/15 focus:border-[#1F7A4C]">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC]">
      <div>
        <div className="text-sm font-semibold text-[#111827]">{label}</div>
        <div className="text-xs text-[#6B7280]">{desc}</div>
      </div>
      <input type="checkbox" defaultChecked={defaultChecked} className="w-4 h-4 accent-[#1F7A4C]" />
    </div>
  )
}

function SaveRow() {
  return (
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F3F4F6]">
      <button className="px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB]">Cancel</button>
      <button className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1F7A4C] text-white text-sm font-semibold hover:bg-[#16643D]">
        <Save size={14} /> Save changes
      </button>
    </div>
  )
}

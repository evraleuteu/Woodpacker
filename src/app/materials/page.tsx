'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Upload,
  BookOpen,
  Mic,
  FileText,
} from 'lucide-react'

const materials = [
  {
    id: '1',
    title: 'German A1 Textbook',
    type: 'Book',
    language: 'German',
    status: 'Active',
    progress: 65,
    uploaded: '2 weeks ago',
    stats: { chapters: 12, lessons: 24, vocabulary: 186, grammar: 48, speaking: 48 },
  },
  {
    id: '2',
    title: 'French Dialogue Course',
    type: 'Audio',
    language: 'French',
    status: 'Processing',
    progress: 30,
    uploaded: '3 days ago',
    stats: { chapters: 0, lessons: 6, vocabulary: 94, grammar: 22, speaking: 31 },
  },
  {
    id: '3',
    title: 'Spanish Verb Conjugation Notes',
    type: 'Notes',
    language: 'Spanish',
    status: 'Pending',
    progress: 0,
    uploaded: '1 day ago',
    stats: { chapters: 0, lessons: 8, vocabulary: 67, grammar: 31, speaking: 12 },
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function MaterialsPage() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-8 max-w-6xl mx-auto"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Language Materials</h1>
          <p className="text-[#A8A29E] text-sm mt-1">Your uploaded textbooks, courses, and notes.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#059669] to-[#10B981] text-white text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.97]"
        >
          <Upload size={14} />
          Upload New
        </Link>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        {materials.map((m) => (
          <div key={m.id} className="glass-card rounded-xl p-6 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(250,248,245,0.03)] flex items-center justify-center shrink-0">
                  {m.type === 'Book' ? <BookOpen size={16} className="text-[#10B981]" /> : m.type === 'Audio' ? <Mic size={16} className="text-[#059669]" /> : <FileText size={16} className="text-[#F59E0B]" />}
                </div>
                <div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-0.5">
                    <span>{m.type}</span>
                    <span>&middot;</span>
                    <span>{m.language}</span>
                    <span>&middot;</span>
                    <span>Uploaded {m.uploaded}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    m.status === 'Active'
                      ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
                      : m.status === 'Processing'
                      ? 'bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border-[rgba(245,158,11,0.2)]'
                      : 'bg-[rgba(107,114,128,0.1)] text-[#6B7280] border-[rgba(107,114,128,0.2)]'
                  }`}
                >
                  {m.status}
                </span>
                <span className="text-sm font-semibold text-gradient">{m.progress}%</span>
              </div>
            </div>

            <div className="progress-bar mb-4">
              <div className="progress-bar-fill" style={{ width: `${m.progress}%` }} />
            </div>

            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Lessons', value: m.stats.lessons },
                { label: 'Vocabulary', value: m.stats.vocabulary },
                { label: 'Grammar', value: m.stats.grammar },
                { label: 'Speaking', value: m.stats.speaking },
                { label: 'Patterns', value: m.stats.chapters },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-2.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)]">
                  <div className="text-sm font-bold">{stat.value}</div>
                  <div className="text-xs text-[#6B7280]">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-[rgba(250,248,245,0.06)]">
              <Link
                href="/speaking"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[rgba(16,185,129,0.1)] to-[rgba(5,150,105,0.08)] border border-[rgba(16,185,129,0.2)] text-[#10B981] text-xs font-medium hover:border-[rgba(16,185,129,0.35)] transition-all"
              >
                <Mic size={12} />
                Start Speaking
              </Link>
              <Link
                href="/cycles"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-all"
              >
                Review Cycles
              </Link>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(250,248,245,0.02)] border border-[rgba(250,248,245,0.06)] text-xs text-[#6B7280] hover:text-[#FAF8F5] transition-all">
                Details
              </button>
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  )
}

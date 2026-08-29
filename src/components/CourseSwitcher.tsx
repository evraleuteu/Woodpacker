'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { useCourses, useActiveCourseId } from '@/lib/useCourse'
import { setActiveCourseId, deleteCourse } from '@/lib/storage'
import { ChevronDown, Trash2, Check, Plus, BookOpen } from 'lucide-react'
import Link from 'next/link'

export default function CourseSwitcher() {
  const courses = useCourses()
  const activeId = useActiveCourseId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const active = mounted ? (courses.find((c) => c.id === activeId) ?? courses[0]) : undefined

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left bg-[#F9FAFB] border border-[#E5E7EB] hover:bg-white hover:border-[#D1D5DB] hover:shadow-sm transition-all"
      >
        <div className="w-7 h-7 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
          <BookOpen size={13} className="text-[#1F7A4C]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[#111827] truncate leading-none">{active?.title ?? 'Select a course'}</div>
          <div className="text-[11px] text-[#6B7280] truncate">{active ? `${active.modules.length} modules` : 'No active course'}</div>
        </div>
        <ChevronDown size={14} className={`shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-2 py-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-xl overflow-hidden">
          {courses.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <div className="text-xs font-medium text-[#111827]">No courses yet</div>
              <div className="text-[11px] text-[#6B7280] mb-3">Upload materials to get started</div>
              <Link
                href="/upload"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1F7A4C] text-white text-xs font-semibold hover:bg-[#16643D] transition-colors"
              >
                <Plus size={12} /> Upload new course
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-72 overflow-y-auto px-2">
              {courses.map((course) => (
                <div key={course.id} className={`flex items-center gap-2 px-2 py-2 rounded-xl group ${course.id === activeId ? 'bg-[#F0FDF4] border border-[#BBF7D0]' : 'hover:bg-[#F9FAFB] border border-transparent'}`}>
                  <button
                    onClick={() => {
                      setActiveCourseId(course.id)
                      setOpen(false)
                    }}
                    className={`flex items-center gap-2 text-xs flex-1 min-w-0 text-left ${
                      course.id === activeId ? 'text-[#1F7A4C] font-semibold' : 'text-[#374151]'
                    }`}
                  >
                    {course.id === activeId && <Check size={12} className="text-[#1F7A4C] shrink-0" />}
                    <span className="truncate">{course.title}</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${course.title}" from your library?`)) {
                        deleteCourse(course.id)
                      }
                    }}
                    className="ml-1 p-1.5 text-[#9CA3AF] hover:text-[#EF4444] hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-[#FECACA]"
                    title="Remove course"
                    aria-label="Remove course"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="border-t border-[#F3F4F6] mt-2 pt-2 px-1">
                <Link
                  href="/upload"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-[#1F7A4C] hover:bg-[#F0FDF4] rounded-xl transition-colors"
                >
                  <Plus size={14} /> Upload new course
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { Clock, Zap } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'

interface PerformanceMetricsProps {
  metrics: {
    stages: Array<{ name: string; durationMs: number; avgDurationMs: number }>
    totalDurationMs: number
    failureCount: number
    retryCount: number
  }
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week' | 'month'>('day')
  const totalStages = metrics.stages.length
  const successRate = totalStages > 0 ? ((totalStages - metrics.failureCount) / totalStages) * 100 : 100

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[#A8A29E]">Time range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="bg-[rgba(250,248,245,0.03)] border border-[rgba(250,248,245,0.06)] rounded-lg px-3 py-1.5 text-sm text-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
          >
            <option value="hour">Last Hour</option>
            <option value="day">Last 24h</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Total Duration"
          value={`${(metrics.totalDurationMs / 1000).toFixed(2)}s`}
          color="text-[#8B5CF6]"
        />
        <MetricCard
          label="Avg Stage Time"
          value={`${Math.round(metrics.totalDurationMs / Math.max(1, totalStages))}ms`}
          color="text-[#F59E0B]"
        />
        <MetricCard
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          color={successRate >= 95 ? 'text-[#10B981]' : successRate >= 80 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}
        />
        <MetricCard
          label="Failures"
          value={metrics.failureCount.toString()}
          color={metrics.failureCount === 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}
        />
        <MetricCard
          label="Retries"
          value={metrics.retryCount.toString()}
          color={metrics.retryCount === 0 ? 'text-[#10B981]' : 'text-[#F59E0B]'}
        />
      </div>

      <div>
        <h4 className="font-medium text-[#FAF8F5] mb-3">Stage Performance</h4>
        <div className="space-y-3">
          {metrics.stages.map((stage, i) => {
            const ratio = stage.durationMs / Math.max(1, stage.avgDurationMs)
            const isSlow = ratio > 1.5
            return (
              <motion.div
                key={stage.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#EC4899] flex items-center justify-center">
                      <Zap size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-[#FAF8F5]">{stage.name}</p>
                      <p className="text-xs text-[#A8A29E]">{stage.durationMs}ms · avg {stage.avgDurationMs}ms</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${isSlow ? 'bg-[#EF4444]/20 text-[#EF4444]' : 'bg-[#10B981]/20 text-[#10B981]'}`}>
                    {isSlow ? '⚠ Slow' : '✓ Normal'}
                  </span>
                </div>
                <div className="h-2 bg-[rgba(250,248,245,0.06)] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, ratio * 50)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: isSlow ? '#EF4444' : '#10B981' }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
      <div className="flex items-center gap-2 mb-2">
        <Clock size={14} className="text-[#8B5CF6]" />
        <span className="text-xs text-[#A8A29E]">{label}</span>
      </div>
      <p className={`font-bold text-2xl ${color}`}>{value}</p>
    </div>
  )
}
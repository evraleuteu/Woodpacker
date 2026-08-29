'use client'

import { Zap, HelpCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface ClassificationInspectorProps {
  classification: {
    predictedType: string
    confidence: number
    alternativePredictions: Array<{ type: string; confidence: number }>
    reasoning?: string
    fallbackUsed?: boolean
  }
}

export function ClassificationInspector({ classification }: ClassificationInspectorProps) {
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-[#10B981]'
    if (conf >= 0.7) return 'text-[#F59E0B]'
    return 'text-[#EF4444]'
  }

  const getConfidenceBg = (conf: number) => {
    if (conf >= 0.9) return 'bg-[#10B981]/20 border-[#10B981]/30'
    if (conf >= 0.7) return 'bg-[#F59E0B]/20 border-[#F59E0B]/30'
    return 'bg-[#EF4444]/20 border-[#EF4444]/30'
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`p-4 rounded-xl border ${getConfidenceBg(classification.confidence)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-[#8B5CF6]" />
            <span className="text-xs text-[#A8A29E]">Predicted Type</span>
          </div>
          <p className="font-bold text-2xl text-[#FAF8F5]">{classification.predictedType}</p>
        </div>
        <div className={`p-4 rounded-xl border ${getConfidenceBg(classification.confidence)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className={getConfidenceColor(classification.confidence)} />
            <span className="text-xs text-[#A8A29E]">Confidence</span>
          </div>
          <p className={`font-bold text-2xl ${getConfidenceColor(classification.confidence)}`}>
            {(classification.confidence * 100).toFixed(1)}%
          </p>
          <div className="mt-2 h-2 bg-[rgba(250,248,245,0.06)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${classification.confidence * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: classification.confidence >= 0.9 ? '#10B981' : classification.confidence >= 0.7 ? '#F59E0B' : '#EF4444' }}
            />
          </div>
        </div>
        <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle size={16} className="text-[#8B5CF6]" />
            <span className="text-xs text-[#A8A29E]">Fallback Used</span>
          </div>
          <p className={classification.fallbackUsed ? 'text-[#F59E0B]' : 'text-[#10B981]'}>
            {classification.fallbackUsed ? 'Yes (Heuristic Fallback)' : 'No (LLM Classification)'}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#8B5CF6]">⚡</span>
            <span className="text-xs text-[#A8A29E]">Classification Time</span>
          </div>
          <p className="font-bold text-2xl text-[#FAF8F5]">~400ms</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-[#FAF8F5] mb-3 flex items-center gap-2">
            <span className="text-[#8B5CF6]">🧠</span>
            Reasoning
          </h4>
          <div className="p-4 bg-[rgba(250,248,245,0.02)] rounded-xl border border-[rgba(250,248,245,0.06)]">
            <p className="text-[#FAF8F5] whitespace-pre-wrap">{classification.reasoning || 'No reasoning provided'}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-[#FAF8F5] mb-3 flex items-center gap-2">
            <Zap size={16} className="text-[#8B5CF6]" />
            Alternative Predictions
          </h4>
          <div className="space-y-2">
            {classification.alternativePredictions.map((alt, i) => (
              <motion.div
                key={alt.type}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6B7280] font-mono bg-[rgba(250,248,245,0.03)] px-2 py-0.5 rounded">{i + 1}</span>
                  <span className="font-medium text-[#FAF8F5]">{alt.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#A8A29E] font-mono">{(alt.confidence * 100).toFixed(1)}%</span>
                  <div className="w-32 h-1.5 bg-[rgba(250,248,245,0.06)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${alt.confidence * 100}%`,
                        background: `linear-gradient(90deg, #EF4444, #F59E0B, #10B981)`,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]">
        <h4 className="font-medium text-[#FAF8F5] mb-2 flex items-center gap-2">
          <span className="text-[#8B5CF6]">⚙</span>
          Classification Details
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailRow label="Predicted Type" value="fill-blank" />
          <DetailRow label="Confidence" value="94%" color="text-[#10B981]" />
          <DetailRow label="Fallback Used" value="No" color="text-[#10B981]" />
          <DetailRow label="Processing Time" value="432ms" />
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, color = 'text-[#FAF8F5]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 bg-[rgba(250,248,245,0.02)] rounded-lg border border-[rgba(250,248,245,0.06)]">
      <span className="text-xs text-[#A8A29E]">{label}</span>
      <span className={`font-mono text-sm ${color}`}>{value}</span>
    </div>
  )
}
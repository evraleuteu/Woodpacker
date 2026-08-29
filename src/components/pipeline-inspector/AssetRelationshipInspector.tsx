'use client'

import { Volume2, Video, Image, FileText, Play, ExternalLink, type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AudioAsset { id: string; name: string; path: string; confidence: number; objectKey?: string }

interface VideoAsset { id: string; name: string; path: string; confidence: number; objectKey?: string }

interface ImageAsset { id: string; name: string; page: number; bbox: number[]; ext: string; description?: string; confidence: number; objectKey?: string }

interface SolutionAsset { id: string; source: string; page: number; answer?: string; confidence: number }

interface AssetCardProps<T extends { id: string }> {
  icon: LucideIcon
  label: string
  color: string
  items: T[]
  renderItem: (item: T) => ReactNode
  emptyMessage: string
}

interface AssetRelationshipInspectorProps {
  assets: {
    audio: AudioAsset[]
    video: VideoAsset[]
    images: ImageAsset[]
    solutions: SolutionAsset[]
  }
  exerciseId: string
}

function AssetCard<T extends { id: string }>({ icon: Icon, label, color, items, renderItem, emptyMessage }: AssetCardProps<T>) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium text-[#FAF8F5] flex items-center gap-2">
        <Icon size={16} className={color} />
        {label} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-[#6B7280] text-center py-4">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-lg border border-[rgba(250,248,245,0.06)] bg-[rgba(250,248,245,0.02)]"
            >
              {renderItem(item)}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AssetRelationshipInspector({ assets }: AssetRelationshipInspectorProps) {
  const mediaUrl = (objectKey?: string) => (objectKey ? `/api/materials/content?key=${encodeURIComponent(objectKey)}` : '')
  const playAudio = (objectKey?: string) => {
    if (objectKey) {
      const audio = new Audio(mediaUrl(objectKey))
      audio.play()
    }
  }

  return (
    <div className="space-y-6">
      <AssetCard
        icon={Volume2}
        label="Associated Audio"
        color="text-[#3B82F6]"
        items={assets.audio}
        emptyMessage="No audio assets linked to this exercise"
        renderItem={(audio) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-[#3B82F6]/20 flex items-center justify-center">
                <Volume2 size={18} className="text-[#3B82F6]" />
              </div>
              <div>
                <p className="font-medium text-[#FAF8F5]">{audio.name}</p>
                <p className="text-xs text-[#A8A29E] flex items-center gap-1">
                  <span>Confidence: {(audio.confidence * 100).toFixed(0)}%</span>
                  {audio.objectKey && <span className="ml-2 px-1.5 py-0.5 bg-[#3B82F6]/20 text-[#3B82F6] rounded text-[10px]">MinIO</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => playAudio(audio.objectKey)}
                className="p-2 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] transition-colors"
                title="Play audio"
              >
                <Play size={16} />
              </button>
              {audio.objectKey && (
                <a
                  href={mediaUrl(audio.objectKey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E] transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      />

      <AssetCard
        icon={Video}
        label="Associated Video"
        color="text-[#EC4899]"
        items={assets.video}
        emptyMessage="No video assets linked to this exercise"
        renderItem={(video) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-[#EC4899]/20 flex items-center justify-center">
                <Video size={18} className="text-[#EC4899]" />
              </div>
              <div>
                <p className="font-medium text-[#FAF8F5]">{video.name}</p>
                <p className="text-xs text-[#A8A29E] flex items-center gap-1">
                  Confidence: {(video.confidence * 100).toFixed(0)}%
                  {video.objectKey && <span className="ml-2 px-1.5 py-0.5 bg-[#EC4899]/20 text-[#EC4899] rounded text-[10px]">MinIO</span>}
                </p>
              </div>
            </div>
            {video.objectKey && (
              <a
                href={mediaUrl(video.objectKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E] transition-colors"
                title="Open video"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}
      />

      <AssetCard
        icon={Image}
        label="Associated Images"
        color="text-[#10B981]"
        items={assets.images}
        emptyMessage="No images linked to this exercise"
        renderItem={(img) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-16 h-10 rounded-lg bg-[#10B981]/20 flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-gradient-to-br from-[#10B981]/20 to-[#10B981]/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#FAF8F5] truncate">{img.name}</p>
                <p className="text-xs text-[#A8A29E] flex items-center gap-2">
                  <span>Page: {img.page}</span>
                  <span>Confidence: {(img.confidence * 100).toFixed(0)}%</span>
                  {img.description && <span className="text-[#A8A29E]">{img.description}</span>}
                  {img.objectKey && <span className="px-1.5 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-[10px]">MinIO</span>}
                </p>
              </div>
            </div>
            {img.objectKey && (
              <a
                href={mediaUrl(img.objectKey)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[rgba(250,248,245,0.03)] hover:bg-[rgba(250,248,245,0.06)] text-[#A8A29E] transition-colors"
                title="Open image"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}
      />

      <AssetCard
        icon={FileText}
        label="Associated Solutions"
        color="text-[#F59E0B]"
        items={assets.solutions}
        emptyMessage="No solutions linked to this exercise"
        renderItem={(sol) => (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <FileText size={18} className="text-[#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#FAF8F5]">{sol.source}</p>
                <p className="text-xs text-[#A8A29E] flex items-center gap-2">
                  <span>Page: {sol.page}</span>
                  <span>Confidence: {(sol.confidence * 100).toFixed(0)}%</span>
                  {sol.answer && <span className="text-[#10B981] font-mono text-xs">Answer: {sol.answer.slice(0, 50)}...</span>}
                </p>
              </div>
            </div>
          </div>
        )}
      />
    </div>
  )
}
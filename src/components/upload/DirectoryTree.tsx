'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Folder,
  FileText,
  Mic,
  Video,
  Image as ImageIcon,
  File as FileIcon,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  BookOpen,
  HelpCircle,
} from 'lucide-react'
import type { AssetKind, UploadedAsset } from '@/lib/types'

export interface FileNode {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  children?: FileNode[]
  size?: number
  kind?: AssetKind
  asset?: UploadedAsset
  status?: 'pending' | 'parsing' | 'ok' | 'empty' | 'failed'
  reused?: boolean
  materialType?: 'textbook' | 'workbook' | 'teacher-handbook' | 'reference' | 'audio' | 'video' | 'image' | 'other'
  expanded?: boolean
  parent?: FileNode
}

const KIND_ICONS: Record<AssetKind, typeof FileText> = {
  pdf: BookOpen,
  docx: FileText,
  epub: BookOpen,
  pptx: FileText,
  text: FileText,
  audio: Mic,
  video: Video,
  image: ImageIcon,
  unknown: FileIcon,
}

const KIND_COLORS: Record<AssetKind, string> = {
  pdf: '#059669',
  docx: '#3B82F6',
  epub: '#8B5CF6',
  pptx: '#F59E0B',
  text: '#14B8A6',
  audio: '#10B981',
  video: '#EC4899',
  image: '#F97316',
  unknown: '#6B7280',
}

const MATERIAL_LABELS: Record<string, string> = {
  textbook: 'Course Book',
  workbook: 'Workbook',
  'teacher-handbook': 'Teacher Handbook',
  reference: 'Reference',
  audio: 'Audio',
  video: 'Video',
  image: 'Image',
  other: 'Other',
}

const MATERIAL_COLORS: Record<string, string> = {
  textbook: '#059669',
  workbook: '#3B82F6',
  'teacher-handbook': '#8B5CF6',
  reference: '#14B8A6',
  audio: '#10B981',
  video: '#EC4899',
  image: '#F97316',
  other: '#6B7280',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getStatusIcon(status: FileNode['status']) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 size={12} className="text-[#10B981]" />
    case 'failed':
      return <AlertCircle size={12} className="text-[#EF4444]" />
    case 'parsing':
      return <Loader2 size={12} className="text-[#F59E0B] animate-spin" />
    case 'empty':
      return <Zap size={12} className="text-[#8B5CF6]" />
    default:
      return <HelpCircle size={12} className="text-[#6B7280]" />
  }
}

interface DirectoryTreeProps {
  roots: FileNode[]
  onFileClick?: (node: FileNode) => void
  selectedPath?: string
  showStatus?: boolean
  showMaterialType?: boolean
}

export function DirectoryTree({
  roots,
  onFileClick,
  selectedPath,
  showStatus = true,
  showMaterialType = true,
}: DirectoryTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const isExpanded = (path: string) => expandedPaths.has(path)

  const renderNode = (node: FileNode, depth = 0): React.ReactElement => {
    const hasChildren = node.children && node.children.length > 0
    const isSelected = selectedPath === node.fullPath
    const nodeExpanded = isExpanded(node.fullPath)

    if (hasChildren) {
      return (
        <motion.div key={node.fullPath} layout>
          <div
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
              isSelected ? 'bg-[rgba(16,185,129,0.1)]' : 'hover:bg-[rgba(250,248,245,0.03)]'
            }`}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(node.fullPath)
            }}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            <ChevronRight
              size={14}
              className={`text-[#6B7280] transition-transform ${nodeExpanded ? 'rotate-90' : ''}`}
            />
            <Folder
              size={16}
              className={`flex-shrink-0 ${
                nodeExpanded ? 'text-[#F59E0B]' : 'text-[#F59E0B]'
              }`}
            />
            <span className="text-sm font-medium truncate flex-1">{node.name}</span>
            {showMaterialType && node.materialType && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
                style={{
                  backgroundColor: `${MATERIAL_COLORS[node.materialType]}1A`,
                  color: MATERIAL_COLORS[node.materialType],
                  borderColor: `${MATERIAL_COLORS[node.materialType]}40`,
                }}
              >
                {MATERIAL_LABELS[node.materialType]}
              </span>
            )}
          </div>
          {nodeExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              {node.children!.map((child) => renderNode(child, depth + 1))}
            </motion.div>
          )}
        </motion.div>
      )
    }

    const Icon = node.kind ? KIND_ICONS[node.kind] : FileIcon
    const color = node.kind ? KIND_COLORS[node.kind] : '#6B7280'

    return (
      <div
        key={node.fullPath}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-[rgba(16,185,129,0.1)]' : 'hover:bg-[rgba(250,248,245,0.03)]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onFileClick?.(node)
        }}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="w-6 flex-shrink-0" />
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <Icon size={12} />
        </div>
        <span className="text-sm font-medium truncate flex-1">{node.name}</span>
        {showMaterialType && node.materialType && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0"
            style={{
              backgroundColor: `${MATERIAL_COLORS[node.materialType]}1A`,
              color: MATERIAL_COLORS[node.materialType],
              borderColor: `${MATERIAL_COLORS[node.materialType]}40`,
            }}
          >
            {MATERIAL_LABELS[node.materialType]}
          </span>
        )}
        {node.size !== undefined && (
          <span className="text-[11px] text-[#6B7280] shrink-0">{formatSize(node.size)}</span>
        )}
        {node.reused && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] text-[#F59E0B] shrink-0">
            Already uploaded
          </span>
        )}
        {showStatus && node.status && <span className="shrink-0">{getStatusIcon(node.status)}</span>}
      </div>
    )
  }

  if (!roots.length) {
    return (
      <div className="text-center py-8 text-[#6B7280]">
        <Folder size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">No files or folders uploaded</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {roots.map((root) => renderNode(root))}
    </div>
  )
}

export function buildFileTree(entries: { file: File; path?: string; kind?: AssetKind; asset?: UploadedAsset; status?: FileNode['status']; reused?: boolean }[]): FileNode[] {
  const rootMap = new Map<string, FileNode>()

  for (const entry of entries) {
    const path = entry.path || ''
    const parts = path ? path.split('/') : [entry.file.name]
    let currentPath = ''
    let parent: FileNode | undefined

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const prevPath = currentPath
      currentPath = prevPath ? `${prevPath}/${part}` : part

      let node = rootMap.get(currentPath)

      if (!node) {
        const dirCheck = !isLast || (Boolean(entry.path) && entry.path!.includes('/') && i < parts.length - 1)
        const isDirectory = Boolean(dirCheck)
        node = {
          name: part,
          path: part,
          fullPath: currentPath,
          isDirectory,
          children: [],
          parent,
          materialType: isLast ? classifyMaterial(part, entry.kind) : undefined,
        }
        rootMap.set(currentPath, node)

        if (parent) {
          if (!parent.children) parent.children = []
          if (!parent.children.some((c) => c.fullPath === currentPath)) {
            parent.children.push(node)
          }
        }
      }

      if (isLast) {
        node.isDirectory = false
        node.size = entry.file.size
        node.kind = entry.kind
        node.asset = entry.asset
        node.status = entry.status
        node.reused = entry.reused
        node.materialType = classifyMaterial(part, entry.kind)
      }

      parent = node
    }
  }

  const roots = Array.from(rootMap.values()).filter((n) => !n.parent)
  sortTree(roots)
  return roots
}

function classifyMaterial(name: string, kind?: AssetKind): FileNode['materialType'] {
  const lower = name.toLowerCase()
  if (kind === 'audio') return 'audio'
  if (kind === 'video') return 'video'
  if (kind === 'image') return 'image'
  if (kind === 'pdf' || kind === 'epub') {
    if (/\b(kursbuch|coursebook|textbook|student|sch[üu]lerbuch|lehrbuch)\b/i.test(lower)) return 'textbook'
    if (/\b(übungsbuch|ubungsbuch|arbeitsbuch|workbook|exercise.?book|practice.?book|arbeitsheft)\b/i.test(lower)) return 'workbook'
    if (/\b(unterrichtshandbuch|lehrerhandbuch|teacher|handbook|guide|solutions|l[öo]sung|l[öo]sungen|answer.?key|tchr)\b/i.test(lower)) return 'teacher-handbook'
    if (/\b(glossar|glossary|wortschatz|grammatik|extras?|zusatz)\b/i.test(lower)) return 'reference'
    return 'textbook'
  }
  if (kind === 'docx' || kind === 'pptx' || kind === 'text') {
    if (/\b(worksheet|arbeitsblatt|exercise|übung|activity)\b/i.test(lower)) return 'workbook'
    return 'reference'
  }
  return 'other'
}

function sortTree(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  for (const node of nodes) {
    if (node.children) sortTree(node.children)
  }
}
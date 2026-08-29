'use client'

import ReactFlow, { Background, Controls, MiniMap, Node, NodeTypes, EdgeTypes, NodeProps, EdgeProps } from 'reactflow'
import { useMemo } from 'react'
import 'reactflow/dist/style.css'

interface RelationshipGraphProps {
  graph: {
    nodes: Array<{ id: string; type: string; label: string; data?: Record<string, unknown> }>
    edges: Array<{ id: string; source: string; target: string; relationship: string; confidence: number }>
  }
}

interface NodeData {
  label: string
  [key: string]: unknown
}

interface EdgeData {
  relationship: string
  confidence: number
}

const nodeTypes: NodeTypes = {
  exercise: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 rounded-lg text-white text-sm font-medium">
      📝 {data.label}
    </div>
  ),
  lesson: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-lg text-white text-sm font-medium">
      📚 {data.label}
    </div>
  ),
  chapter: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg text-white text-sm font-medium">
      📖 {data.label}
    </div>
  ),
  material: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#F59E0B]/20 border border-[#F59E0B]/30 rounded-lg text-white text-sm font-medium">
      📦 {data.label}
    </div>
  ),
  audio: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#3B82F6]/20 border border-[#3B82F6]/30 rounded-lg text-white text-sm font-medium">
      🔊 {data.label}
    </div>
  ),
  video: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#EC4899]/20 border border-[#EC4899]/30 rounded-lg text-white text-sm font-medium">
      🎬 {data.label}
    </div>
  ),
  image: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#10B981]/20 border border-[#10B981]/30 rounded-lg text-white text-sm font-medium">
      🖼 {data.label}
    </div>
  ),
  solution: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#F59E0B]/20 border border-[#F59E0B]/30 rounded-lg text-white text-sm font-medium">
      ✓ {data.label}
    </div>
  ),
  default: ({ data }: NodeProps<NodeData>) => (
    <div className="px-3 py-2 bg-[#6B7280]/20 border border-[#6B7280]/30 rounded-lg text-white text-sm font-medium">
      {data.label}
    </div>
  ),
}

const edgeTypes: EdgeTypes = {
  default: ({ style }: EdgeProps<EdgeData>) => (
    <>
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
        d={getEdgePath()}
        style={{ ...style, strokeDasharray: '5,5', opacity: 0.6 }}
      />
    </>
  ),
}

function getEdgePath() {
  return 'M 0 0 L 100 0'
}

export function RelationshipGraph({ graph }: RelationshipGraphProps) {
  const nodes = useMemo(() =>
    graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 },
      data: { label: n.label, ...n.data },
    })),
    [graph.nodes]
  )

  const edges = useMemo(() =>
    graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'default',
      label: `${e.relationship} (${(e.confidence * 100).toFixed(0)}%)`,
      labelStyle: { fontSize: 10, fill: '#A8A29E' },
      labelBgStyle: { fill: 'rgba(12,12,12,0.9)', borderRadius: 3, padding: 2 },
      animated: e.confidence > 0.8,
      data: { relationship: e.relationship, confidence: e.confidence },
    })),
    [graph.edges]
  )

  if (nodes.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <p className="text-[#A8A29E] text-center">No relationship data available</p>
      </div>
    )
  }

  return (
    <div className="h-96 bg-[#0C0C0C] rounded-xl border border-[rgba(250,248,245,0.06)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#A8A29E" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(node: Node) => {
            const colors: Record<string, string> = {
              exercise: '#8B5CF6',
              lesson: '#3B82F6',
              chapter: '#10B981',
              material: '#F59E0B',
              audio: '#3B82F6',
              video: '#EC4899',
              image: '#10B981',
              solution: '#F59E0B',
            }
            return node.type ? colors[node.type] : '#6B7280'
          }}
        />
      </ReactFlow>
    </div>
  )
}
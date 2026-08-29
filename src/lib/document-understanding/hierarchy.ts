/**
 * Element Hierarchy — builds parent/child relationships.
 *
 * Page
 *  ├── background
 *  ├── design_element
 *  │    └── level_badge
 *  ├── heading
 *  ├── subtitle
 *  ├── text
 *  ├── media_marker
 *  └── image
 */
import type { AtomicElement, BBox } from './types'
import { containment } from './geometry'

export interface HierarchyNode extends AtomicElement {
  depth: number
  childrenIds: string[]
}

export function buildHierarchy(elements: AtomicElement[]): Map<string, AtomicElement> {
  const byId = new Map<string, AtomicElement>(elements.map(e => [e.id, { ...e }]))

  // Already have parentId/children from overlap stage — ensure bidirectional
  for (const el of byId.values()) {
    if (el.parentId) {
      const parent = byId.get(el.parentId)
      if (parent) {
        parent.children = [...(parent.children ?? []), el.id]
      }
    }
    if (el.children) {
      for (const cid of el.children) {
        const child = byId.get(cid)
        if (child) child.parentId = el.id
      }
    }
  }

  // Additional hierarchy inference: design_element contains level_badge text
  // e.g., red B2 panel contains "B2" text
  const designEls = [...byId.values()].filter(e => e.type === 'design_element' || e.type === 'level_badge')
  const textEls = [...byId.values()].filter(e => ['text','heading','paragraph'].includes(e.type) && e.text && e.text.trim().length <= 5)

  for (const des of designEls) {
    for (const txt of textEls) {
      if (txt.parentId) continue // already nested
      if (txt.page !== des.page) continue
      if (containment(txt.bbox, des.bbox) > 0.7) {
        txt.parentId = des.id
        des.children = [...(des.children ?? []), txt.id]
      }
    }
  }

  return byId
}

export function flattenHierarchy(byId: Map<string, AtomicElement>): AtomicElement[] {
  return [...byId.values()]
}

export function getRootElements(elements: AtomicElement[]): AtomicElement[] {
  return elements.filter(e => !e.parentId)
}

export function getChildren(parentId: string, elements: AtomicElement[]): AtomicElement[] {
  return elements.filter(e => e.parentId === parentId)
}

export function hierarchyToJson(elements: AtomicElement[]): unknown {
  const byParent = new Map<string | undefined, AtomicElement[]>()
  for (const el of elements) {
    const key = el.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(el)
  }
  function build(nodeId: string | undefined, depth: number): any[] {
    const children = byParent.get(nodeId) ?? []
    return children.map(c => ({
      id: c.id,
      type: c.type,
      subtype: c.subtype,
      text: c.text?.slice(0, 60),
      bbox: c.bbox,
      confidence: c.confidence,
      depth,
      children: build(c.id, depth + 1),
    }))
  }
  return build(undefined, 0)
}

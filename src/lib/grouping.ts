export function stemOf(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  return base
    .replace(/(?:[_\-\s]+(?:cd|track|teil|part|exercise|lesson|lektion)\d*)$/i, '')
    .replace(/(?:[_\-\s]+\d+(?:[_\-\s]+\d+)*)$/, '')
    .replace(/[_\-\s]+$/, '')
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1) : ''
}

export interface FileGroup<T extends { name: string; path?: string }> {
  key: string
  display: string
  folder?: string
  stem: string
  files: T[]
}

export function groupFiles<T extends { name: string; path?: string }>(files: T[]): FileGroup<T>[] {
  const groups = new Map<string, { folder?: string; stem: string; files: T[] }>()
  const order: string[] = []
  for (const file of files) {
    const folder = file.path ? file.path.split('/')[0] : undefined
    const stem = stemOf(file.name)
    const key = `${folder ?? ''}|${stem}`
    if (!groups.has(key)) {
      order.push(key)
      groups.set(key, { folder, stem, files: [] })
    }
    groups.get(key)!.files.push(file)
  }
  return order.map((key) => {
    const g = groups.get(key)!
    const ext = extOf(g.files[0].name)
    const collapsed = g.files.length > 1
    const display = collapsed
      ? `${g.folder ? g.folder + '. ' : ''}${g.stem}.${ext}`
      : g.folder
        ? `${g.folder}. ${g.files[0].name}`
        : g.files[0].name
    return { key, display, folder: g.folder, stem: g.stem, files: g.files }
  })
}
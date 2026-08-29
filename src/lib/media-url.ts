export interface ViewableMedia {
  dataUrl?: string
  objectKey?: string
}

/**
 * Returns a browser-viewable URL for a course source file, preferring the
 * in-memory data URL and falling back to the MinIO object served through
 * `/api/materials/content`. Returns null when neither is available.
 */
export function mediaUrlFor(file: ViewableMedia): string | null {
  if (file.dataUrl) return file.dataUrl
  if (file.objectKey) return `/api/materials/content?key=${encodeURIComponent(file.objectKey)}`
  return null
}

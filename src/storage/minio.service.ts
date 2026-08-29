// MinIO object storage service for woodpacker
// Stores uploaded learning materials (pdf, docx, epub, pptx, audio, video, images)

import { Client } from 'minio'
import { Transform } from 'stream'

const ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const PORT = Number(process.env.MINIO_API_PORT || 9000)
const USE_SSL = process.env.MINIO_USE_SSL === 'true'
const ACCESS_KEY = process.env.MINIO_ROOT_USER || 'woodpacker'
const SECRET_KEY = process.env.MINIO_ROOT_PASSWORD || 'woodpacker_minio_password'

export const BUCKET = process.env.MINIO_BUCKET || 'woodpacker-files'

let client: Client | null = null

export function getMinioClient(): Client {
  if (!client) {
    client = new Client({
      endPoint: ENDPOINT,
      port: PORT,
      useSSL: USE_SSL,
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
    })
  }
  return client
}

export async function ensureBucket(bucket: string = BUCKET): Promise<void> {
  const c = getMinioClient()
  const exists = await c.bucketExists(bucket)
  if (!exists) {
    await c.makeBucket(bucket)
  }
}

export interface StoredObject {
  objectKey: string
  bucket: string
  size: number
  etag?: string
}

export async function uploadObject(
  data: Buffer | Uint8Array,
  objectKey: string,
  mime: string,
  bucket: string = BUCKET
): Promise<StoredObject> {
  await ensureBucket(bucket)
  const c = getMinioClient()
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
  const info = await c.putObject(bucket, objectKey, buf, buf.length, { 'Content-Type': mime })
  return { objectKey, bucket, size: buf.length, etag: info.etag }
}

export async function uploadObjectStream(
  stream: NodeJS.ReadableStream,
  objectKey: string,
  mime: string,
  bucket: string = BUCKET
): Promise<StoredObject> {
  await ensureBucket(bucket)
  const c = getMinioClient()
  let size = 0
  const counting = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length
      cb(null, chunk)
    },
  })
  const source = stream as import('stream').Readable
  source.pipe(counting)
  const info = await c.putObject(bucket, objectKey, counting as never, undefined, { 'Content-Type': mime })
  return { objectKey, bucket, size, etag: info.etag }
}

export async function getObjectUrl(
  objectKey: string,
  bucket: string = BUCKET,
  expiresSeconds = 3600
): Promise<string> {
  const c = getMinioClient()
  return c.presignedGetObject(bucket, objectKey, expiresSeconds)
}

export async function getObject(
  objectKey: string,
  bucket: string = BUCKET
): Promise<{ data: Buffer; mime: string; size: number } | null> {
  const c = getMinioClient()
  try {
    const stream = await c.getObject(bucket, objectKey)
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const data = Buffer.concat(chunks)
    const stat = await c.statObject(bucket, objectKey)
    return { data, mime: stat.metaData?.['content-type'] ?? 'application/octet-stream', size: stat.size }
  } catch (err) {
    if ((err as { code?: string }).code === 'NoSuchKey') return null
    throw err
  }
}

export async function getObjectStream(
  objectKey: string,
  bucket: string = BUCKET
): Promise<{ stream: NodeJS.ReadableStream; mime: string; size: number } | null> {
  const c = getMinioClient()
  try {
    const stream = await c.getObject(bucket, objectKey)
    const stat = await c.statObject(bucket, objectKey)
    return { stream, mime: stat.metaData?.['content-type'] ?? 'application/octet-stream', size: stat.size }
  } catch (err) {
    if ((err as { code?: string }).code === 'NoSuchKey') return null
    throw err
  }
}

export async function listObjects(prefix = '', bucket: string = BUCKET): Promise<string[]> {
  const c = getMinioClient()
  const keys: string[] = []
  const stream = c.listObjectsV2(bucket, prefix, true)
  for await (const obj of stream) {
    if (obj.name) keys.push(obj.name)
  }
  return keys
}

export async function removeObject(objectKey: string, bucket: string = BUCKET): Promise<void> {
  const c = getMinioClient()
  await c.removeObject(bucket, objectKey)
}

export interface ComposePart {
  bucket: string
  key: string
  size: number
  etag?: string
}

export async function composeObjectParts(
  destBucket: string,
  destKey: string,
  parts: ComposePart[],
  mime = 'application/octet-stream'
): Promise<{ size: number; etag: string | undefined }> {
  const c = getMinioClient()
  const uploadId = await c.initiateNewMultipartUpload(destBucket, destKey, { 'Content-Type': mime })
  try {
    const partsDone: { part: number; etag?: string }[] = []
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const copySource = encodeURI(`${p.bucket}/${p.key}`)
      const headers: Record<string, string> = { 'x-amz-copy-source': copySource }
      if (p.etag) headers['x-amz-copy-source-if-match'] = p.etag
      const res = await c.uploadPart(
        {
          bucketName: destBucket,
          objectName: destKey,
          uploadID: uploadId,
          partNumber: i + 1,
          headers,
        },
        undefined
      )
      partsDone.push({ part: res.part, etag: res.etag })
    }
    const result = await c.completeMultipartUpload(destBucket, destKey, uploadId, partsDone)
    return {
      size: parts.reduce((acc, p) => acc + p.size, 0),
      etag: result.etag,
    }
  } catch (err) {
    await c.abortMultipartUpload(destBucket, destKey, uploadId).catch(() => {})
    throw err
  }
}

export default getMinioClient
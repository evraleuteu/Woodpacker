import { NextResponse } from 'next/server'
import { getLocalUserId } from '@/storage/storage.service'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getLocalUserId()
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    try {
      const rows = await prisma.learningMaterial.findMany({
        where: { user_id: userId },
        select: { id: true, title: true, size: true, type: true, object_key: true },
      })
      return NextResponse.json({
        materials: rows.map((r) => ({
          id: r.id,
          title: r.title,
          size: r.size ? Number(r.size) : null,
          type: r.type,
          objectKey: r.object_key,
        })),
      })
    } finally {
      await prisma.$disconnect()
      await pool.end().catch(() => {})
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not load materials' },
      { status: 500 }
    )
  }
}
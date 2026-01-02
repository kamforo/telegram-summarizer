import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  let dbUrl = process.env.DATABASE_URL || ''

  // For DO managed databases, ensure proper SSL mode
  if (dbUrl.includes('ondigitalocean.com') && !dbUrl.includes('sslmode=')) {
    dbUrl = dbUrl.includes('?') ? `${dbUrl}&sslmode=no-verify` : `${dbUrl}?sslmode=no-verify`
  }

  // Always use PostgreSQL adapter since schema is set to postgresql
  const pool = new Pool({
    connectionString: dbUrl || 'postgresql://localhost:5432/telegram_summarizer',
    ssl: dbUrl.includes('ondigitalocean.com') ? { rejectUnauthorized: false } : undefined
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// Lazy initialization - only create client when first accessed
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return Reflect.get(globalForPrisma.prisma, prop)
  },
})

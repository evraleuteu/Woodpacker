import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit() {
    try {
      await this.$connect()
      this.logger.log('Connected to PostgreSQL')
    } catch (err) {
      // Extraction jobs must still run (and persist best-effort) when the
      // database is temporarily down — BullMQ retries will cover it.
      this.logger.warn(`PostgreSQL connection failed (${(err as Error).message}) — persistence disabled`)
    }
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
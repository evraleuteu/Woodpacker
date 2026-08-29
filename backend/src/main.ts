import 'dotenv/config'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useWebSocketAdapter(new IoAdapter(app))
  const port = Number(process.env.PORT ?? 4000)
  app.enableCors({ origin: true, credentials: true, allowedHeaders: 'Content-Type, Authorization, X-Requested-With' })
  await app.listen(port)
  Logger.log(`Woodpacker backend listening on http://localhost:${port}`, 'Bootstrap')
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
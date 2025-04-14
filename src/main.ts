import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

import './common/config/dayjs.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe())

  process.on('SIGINT', async () => {
    console.log('SIGINT received')
    await app.close()
  })
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received')
    await app.close()
  })

  await app.listen(5000)
}
bootstrap()

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

import { MINI_APP_URL } from '~/constants/env'
import './common/config/dayjs.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: ['http://localhost:3000', MINI_APP_URL]
  })
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

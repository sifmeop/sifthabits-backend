import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { parse, validate } from '@telegram-apps/init-data-node'
import { TELEGRAM_BOT_TOKEN } from '~/constants/env'
import { PrismaService } from '~/prisma/prisma.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()

    const initData = request.headers['tma-init-data']

    try {
      validate(initData, TELEGRAM_BOT_TOKEN)
    } catch (error) {
      return false
    }

    const parsedData = parse(initData)
    const telegramId = String(parsedData.user.id)

    const user = await this.prisma.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true
      }
    })

    if (!user) {
      return false
    }

    request.user = {
      id: user.id
    }

    return true
  }
}

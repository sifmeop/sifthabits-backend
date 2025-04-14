import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { parse, validate } from '@telegram-apps/init-data-node'
import { NODE_ENV, TELEGRAM_BOT_TOKEN } from '~/constants/env'
import { PrismaService } from '~/prisma/prisma.service'
import { IS_PUBLIC } from '../decorators/is-public'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])

    if (isPublic) {
      return true
    }

    const request = context.switchToHttp().getRequest()

    if (NODE_ENV === 'development') {
      request.user = {
        id: '64f20bed-5eed-4ba7-a24d-13066048e57a'
      }
      return true
    }

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

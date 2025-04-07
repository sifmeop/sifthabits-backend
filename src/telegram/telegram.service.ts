import { Injectable } from '@nestjs/common'
import { Context, Telegraf } from 'telegraf'
import { MINI_APP_URL, TELEGRAM_BOT_TOKEN } from '~/constants/env'
import { PrismaService } from '~/prisma/prisma.service'

@Injectable()
export class TelegramService {
  private bot: Telegraf<Context>

  constructor(private readonly prisma: PrismaService) {
    this.bot = new Telegraf<Context>(TELEGRAM_BOT_TOKEN)
    this.setupCommands()
    this.bot.launch()
  }

  private setupCommands() {
    this.bot.command('start', async (ctx) => {
      await this.handleStart(ctx)
    })
  }

  private async handleStart(ctx: Context) {
    const telegramId = String(ctx.from.id)
    const username = ctx.from.username

    const user = await this.prisma.user.findUnique({
      where: {
        telegramId
      },
      select: {
        id: true
      }
    })

    if (!user) {
      await this.prisma.user.create({
        data: {
          telegramId,
          username
        }
      })
    }

    await this.generateMenu(ctx)
  }

  private async generateMenu(ctx: Context) {
    await ctx.sendMessage('Ready to make progress?', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Go to App',
              web_app: {
                url: MINI_APP_URL
              }
            }
          ]
        ]
      }
    })
  }
}

import { Injectable, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common'
import { Context, Telegraf } from 'telegraf'
import { MINI_APP_URL, TELEGRAM_BOT_TOKEN } from '~/constants/env'
import { PrismaService } from '~/prisma/prisma.service'

@Injectable()
export class TelegramService implements OnModuleDestroy, OnApplicationShutdown {
  private bot: Telegraf<Context>

  constructor(private readonly prisma: PrismaService) {
    this.bot = new Telegraf<Context>(TELEGRAM_BOT_TOKEN)
    this.setupCommands()
    this.launchBotSafely()
  }

  private async launchBotSafely() {
    try {
      const isActiveDeployment = process.env.KOYEB_DEPLOYMENT_VERSION === process.env.KOYEB_ACTIVE_DEPLOYMENT_VERSION

      if (isActiveDeployment) {
        console.log('Launching Telegram bot...')
        await this.bot.launch()
      } else {
        console.log('Skipping bot launch during deployment')
      }
    } catch (error) {
      console.error('Failed to launch bot:', error)
    }
  }

  setupCommands() {
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
        isBlocked: true
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

    if (user.isBlocked) {
      await ctx.sendMessage('You are blocked')
      return
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

  async onModuleDestroy() {
    console.log('TelegramService: onModuleDestroy called')
    await this.botStopSafely()
  }

  async onApplicationShutdown(signal: string) {
    console.log(`TelegramService: onApplicationShutdown called with signal: ${signal}`)
    await this.botStopSafely()
  }

  private async botStopSafely() {
    try {
      console.log('Stopping Telegram bot...')
      this.bot.stop()
      console.log('Telegram bot stopped successfully.')
    } catch (error) {
      console.error('Error stopping Telegram bot:', error)
    }
  }
}

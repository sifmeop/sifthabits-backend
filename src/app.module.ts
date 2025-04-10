import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthGuard } from './common/guards/auth.guard'
import { HabitsModule } from './habits/habits.module'
import { PrismaModule } from './prisma/prisma.module'
import { TelegramModule } from './telegram/telegram.module'
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [ConfigModule.forRoot(), ScheduleModule.forRoot(), TelegramModule, PrismaModule, HabitsModule, StatisticsModule],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    }
  ]
})
export class AppModule {}

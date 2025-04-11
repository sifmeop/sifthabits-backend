import { Injectable } from '@nestjs/common'
import { HabitStatus } from '@prisma/client'
import dayjs from 'dayjs'
import { QueryDatesDto } from '~/common/dto/query-dates'
import { calculateXpForNextLevel } from '~/common/utils/calculateXpForNextLevel'
import { getRangeDates } from '~/common/utils/getRangeDates'
import { PrismaService } from '~/prisma/prisma.service'
import { TelegramService } from '~/telegram/telegram.service'

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService
  ) {}

  async getUserStatistics(userId: string, data: QueryDatesDto) {
    const from = new Date(data.from)
    const to = new Date(data.to)

    const rangeDates = getRangeDates(from, to)

    const habits = await this.prisma.habit.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        userHabits: true
      }
    })

    const result = habits.map((habit) => {
      const summary = rangeDates.reduce<Record<string, number | null>>((acc, date) => {
        const dateA = dayjs.utc(date).set('h', 0).set('m', 0).set('s', 0).set('ms', 0)
        const dateB = dayjs.utc(date).set('h', 23).set('m', 59).set('s', 59).set('ms', 999)

        const userHabits = habit.userHabits.filter((userHabit) => {
          return dayjs.utc(userHabit.createdAt).isBetween(dateA, dateB)
        })

        const totalRepeats = habit.repeats * userHabits.length
        const doneRepeats = userHabits.length === 0 ? null : userHabits.reduce((acc, { repeats }) => acc + repeats, 0)
        const percentDone = doneRepeats !== null ? (doneRepeats / totalRepeats) * 100 : null

        acc[dayjs.utc(date).format('YYYY-MM-DD')] = percentDone

        return acc
      }, {})

      const streak = habit.userHabits.reduce((acc, userHabit) => {
        if (userHabit.status === HabitStatus.DONE) {
          acc++
        } else if (userHabit.status === HabitStatus.MISSED) {
          acc = 0
        }

        return acc
      }, 0)

      let longestIndex = 0
      const longest = habit.userHabits.reduce<Record<number, number>>((acc, userHabit) => {
        if (userHabit.status === HabitStatus.DONE) {
          acc[longestIndex] = acc[longestIndex] ? acc[longestIndex] + 1 : 1
        }

        if (userHabit.status === HabitStatus.MISSED) {
          longestIndex++
        }

        return acc
      }, {})

      const completed = habit.userHabits.reduce((acc, userHabit) => {
        if (userHabit.status === HabitStatus.DONE) {
          acc++
        }

        return acc
      }, 0)

      return {
        id: habit.id,
        title: habit.title,
        timeOfDay: habit.timeOfDay,
        streak,
        longest: Math.max(...Object.values(longest)),
        completed,
        summary
      }
    })

    return result
  }

  async getGlobalStatistics(userId: string) {
    const users = await this.prisma.user.findMany()

    const promise = users.map(async ({ id, telegramId, username, level, xp, createdAt }) => {
      const photoUrl = await this.telegramService.getUserPhotoUrl(Number(telegramId))

      return {
        id,
        telegramId,
        username,
        level,
        xp,
        xpToNextLevel: calculateXpForNextLevel(level.toNumber()),
        photoUrl,
        createdAt
      }
    })

    const result = await Promise.all(promise)

    const user = result.find((user) => user.id === userId)

    return {
      user: user,
      users: result
    }
  }
}

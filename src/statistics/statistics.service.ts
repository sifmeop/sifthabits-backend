import { Injectable } from '@nestjs/common'
import { HabitStatus } from '@prisma/client'
import dayjs from 'dayjs'
import { QueryDatesDto } from '~/common/dto/query-dates'
import { getRangeDates } from '~/common/utils/getRangeDates'
import { PrismaService } from '~/prisma/prisma.service'

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics(userId: string, data: QueryDatesDto) {
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
      const summary = rangeDates.reduce((acc, date) => {
        const userHabits = habit.userHabits.filter((userHabit) => {
          const dateA = dayjs.utc(date)
          const dateB = dayjs.utc(date).add(1, 'day').set('s', -1)
          return dayjs.utc(userHabit.createdAt).isBetween(dateA, dateB)
        })

        const totalRepeats = habit.repeats
        const doneRepeats = userHabits[0]?.repeats ?? 0
        const percentDone = (doneRepeats / totalRepeats) * 100

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
        streak,
        longest: Math.max(...Object.values(longest)),
        completed,
        summary
      }
    })

    return result
  }
}

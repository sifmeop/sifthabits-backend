import { HttpException, Injectable, OnModuleInit } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Habit, HabitStatus, Prisma, UserHabit } from '@prisma/client'
import dayjs from 'dayjs'
import { QueryDatesDto } from '~/common/dto/query-dates'
import { calculateXpForNextLevel } from '~/common/utils/calculateXpForNextLevel'
import { getRangeDates } from '~/common/utils/getRangeDates'
import { PrismaService } from '~/prisma/prisma.service'
import { CreateHabitDto } from './dto/create-hobit-dto'
import { EditHabitDto } from './dto/edit-hobit-dto'

@Injectable()
export class HabitsService implements OnModuleInit {
  private readonly XP_PER_HABIT = 10

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.processDailyHabits()
  }

  @Cron('0 * * * *')
  async handleCronEveryHour() {
    await this.processDailyHabits()
  }

  async processDailyHabits() {
    const today = dayjs.utc().startOf('day').set('h', 0).set('m', 0).set('s', 0).set('ms', 0)

    await this.prisma.$transaction(async (tx) => {
      await tx.userHabit.updateMany({
        where: {
          createdAt: {
            lte: today.toDate()
          },
          status: HabitStatus.IN_PROGRESS
        },
        data: {
          status: HabitStatus.MISSED
        }
      })

      const dayOfWeek = today.isoWeekday()

      const habits = await tx.habit.findMany({
        where: {
          weekDays: {
            has: dayOfWeek
          }
        },
        select: {
          id: true,
          userHabits: true
        }
      })

      const now = dayjs.utc()

      const habitsToCreate = habits
        .filter((habit) => !habit.userHabits.some((userHabit) => now.isSame(userHabit.createdAt, 'day')))
        .map((habit, index) => ({
          habitId: habit.id,
          createdAt: now.add(index + 1, 'second').toDate()
        }))

      if (habitsToCreate.length === 0) {
        return
      }

      await tx.userHabit.createMany({
        data: habitsToCreate
      })
    })
  }

  async getHabits(userId: string, data: QueryDatesDto) {
    const from = dayjs.utc(data.from).set('h', 0).set('m', 0).set('s', 0).set('ms', 0)
    const to = dayjs.utc(data.to).set('h', 23).set('m', 59).set('s', 59).set('ms', 999)

    const rangeDates = getRangeDates(from.toDate(), to.toDate())

    const result = await this.prisma.$transaction(async (tx) => {
      const userHabits = await tx.userHabit.findMany({
        where: {
          habit: {
            userId
          }
        },
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          habit: true
        }
      })

      const weeklySummary = rangeDates.reduce<Record<number, (UserHabit & { habit: Habit; streak: number })[]>>(
        (acc, date, index) => {
          const habits = userHabits.filter((userHabit) => dayjs.utc(userHabit.createdAt).isSame(date, 'day'))

          const sortedHabits = habits
            .filter((habit) => dayjs(habit.createdAt).isBetween(from, to))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

          let streak: Record<string, number> | undefined

          if (dayjs.utc().isSame(date, 'day')) {
            streak = userHabits.reduce((acc, userHabit) => {
              if (!acc[userHabit.habitId]) {
                acc[userHabit.habitId] = 0
              }

              if (userHabit.status === HabitStatus.DONE) {
                acc[userHabit.habitId]++
              } else if (userHabit.status === HabitStatus.MISSED) {
                acc[userHabit.habitId] = 0
              }

              return acc
            }, {})
          }

          const result = sortedHabits.map((userHabit) => ({
            ...userHabit,
            streak: streak?.[userHabit.habitId]
          }))

          acc[index + 1] = result

          return acc
        },
        {}
      )

      return weeklySummary
    })

    return result
  }

  async createHabit(userId: string, body: CreateHabitDto) {
    let day = new Date().getDay()
    day = day === 0 ? 7 : day

    const newHabit = await this.prisma.habit.create({
      data: {
        title: body.title,
        repeats: body.repeats,
        weekDays: body.weekDays,
        timeOfDay: body.timeOfDay,
        userId,
        userHabits: body.weekDays.includes(day)
          ? {
              create: {}
            }
          : undefined
      },
      include: {
        userHabits: true
      }
    })

    const { userHabits, ...habit } = newHabit

    const userHabit: UserHabit & { habit: Habit } = {
      ...userHabits[0],
      habit
    }

    return userHabit
  }

  async updateHabit(userId: string, body: EditHabitDto) {
    return await this.prisma.$transaction(async (tx) => {
      const userHabit = await tx.userHabit.findUnique({
        where: {
          id: body.id,
          habit: {
            userId
          }
        },
        include: {
          habit: true
        }
      })

      if (!userHabit) {
        throw new HttpException('Habit not found', 404)
      }

      const newRepeats = body.repeats

      const upHabit = await tx.habit.update({
        where: {
          id: userHabit.habitId
        },
        data: {
          title: body.title,
          repeats: body.repeats,
          weekDays: body.weekDays,
          timeOfDay: body.timeOfDay,
          userHabits: {
            update: {
              where: {
                id: userHabit.id
              },
              data: {
                repeats: userHabit.repeats > newRepeats ? newRepeats : undefined,
                status: userHabit.repeats >= newRepeats ? HabitStatus.DONE : HabitStatus.IN_PROGRESS
              }
            }
          }
        },
        include: {
          userHabits: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 1
          }
        }
      })

      const { userHabits, ...habit } = upHabit

      const upUserHabit: UserHabit & { habit: Habit } = {
        ...userHabits[0],
        habit
      }

      return upUserHabit
    })
  }

  async deleteHabit(userId: string, habitId: string) {
    return await this.prisma.habit.delete({
      where: {
        id: habitId,
        userId
      }
    })
  }

  async markHabitAsDone(userId: string, habitId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const userHabit = await tx.userHabit.findUnique({
        where: {
          id: habitId,
          habit: {
            userId
          }
        },
        include: {
          habit: {
            include: {
              user: true
            }
          }
        }
      })

      if (!userHabit) {
        throw new HttpException('Habit not found', 404)
      }

      if (userHabit.status === HabitStatus.DONE) {
        throw new HttpException('Habit already done', 400)
      }

      const goalRepeats = userHabit.habit.repeats
      const currentRepeats = userHabit.repeats

      const data: Prisma.UserHabitUpdateInput = {
        repeats: {
          increment: 1
        }
      }

      if (currentRepeats + 1 >= goalRepeats) {
        data.status = HabitStatus.DONE
      }

      const upUserHabit = await tx.userHabit.update({
        where: {
          id: habitId
        },
        data,
        include: {
          habit: true
        }
      })

      if (upUserHabit.status !== HabitStatus.DONE) {
        return { habit: upUserHabit, user: null }
      }

      const user = userHabit.habit.user
      let newXp = user.xp.toNumber() + this.XP_PER_HABIT
      let newLevel = user.level.toNumber()

      const xpToNextLevel = calculateXpForNextLevel(newLevel)

      while (newXp >= xpToNextLevel) {
        newXp -= xpToNextLevel
        newLevel++
      }

      const upUser = await tx.user.update({
        where: {
          id: userId
        },
        data: {
          xp: newXp,
          level: newLevel
        },
        select: {
          xp: true,
          level: true
        }
      })

      return {
        habit: upUserHabit,
        user: upUser
      }
    })
  }

  async undoHabit(userId: string, habitId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const userHabit = await tx.userHabit.findUnique({
        where: {
          id: habitId,
          habit: {
            userId
          }
        },
        include: {
          habit: {
            include: {
              user: true
            }
          }
        }
      })

      if (!userHabit) {
        throw new HttpException('Habit not found', 404)
      }

      if (userHabit.repeats === 0) {
        throw new HttpException('Habit already undone', 400)
      }

      const today = dayjs.utc().set('h', 0).set('m', 0).set('s', 0).set('ms', 0)
      const isOldHabit = dayjs.utc(userHabit.createdAt).isBefore(today)

      const newRepeats = isOldHabit ? 0 : userHabit.repeats - 1

      const upUserHabit = await tx.userHabit.update({
        where: {
          id: habitId
        },
        data: {
          repeats: newRepeats,
          status: isOldHabit ? HabitStatus.MISSED : HabitStatus.IN_PROGRESS
        }
      })

      const user = userHabit.habit.user
      let newXp = user.xp.toNumber() - this.XP_PER_HABIT
      let newLevel = user.level.toNumber()

      while (newXp < 0 && newLevel > 0) {
        newLevel--
        const xpForPreviousLevel = calculateXpForNextLevel(newLevel)
        newXp += xpForPreviousLevel
      }

      if (newLevel <= 0) {
        newLevel = 0
        newXp = Math.max(0, newXp)
      }

      const upUser = await tx.user.update({
        where: {
          id: userId
        },
        data: {
          xp: newXp,
          level: newLevel
        },
        select: {
          xp: true,
          level: true
        }
      })

      return { habit: upUserHabit, user: upUser }
    })
  }

  async markHabitAsMissed(userId: string, habitId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const userHabit = await tx.userHabit.findUnique({
        where: {
          id: habitId,
          habit: {
            userId
          }
        },
        include: {
          habit: {
            include: {
              user: true
            }
          }
        }
      })

      if (!userHabit) {
        throw new HttpException('Habit not found', 404)
      }

      if (userHabit.status === HabitStatus.MISSED) {
        throw new HttpException('Habit already missed', 400)
      }

      return await tx.userHabit.update({
        where: {
          id: habitId,
          habit: {
            userId
          }
        },
        data: {
          repeats: 0,
          status: HabitStatus.MISSED
        },
        include: {
          habit: true
        }
      })
    })
  }
}

import { HttpException, Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { Habit, HabitStatus, Prisma, UserHabit } from '@prisma/client'
import * as dayjs from 'dayjs'
import { getRangeDates } from '~/common/utils/getRangeDates'
import { PrismaService } from '~/prisma/prisma.service'
import { CreateHabitDto } from './dto/create-hobit-dto'
import { EditHabitDto } from './dto/edit-hobit-dto'
import { GetHabitsDto } from './dto/get-habits-dto'

@Injectable()
export class HabitsService {
  private readonly XP_PER_HABIT = 10

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *')
  async handleCron() {
    const now = new Date()
    const todayMidnight = new Date(now.setHours(0, 0, 0, 0))
    const yesterdayMidnight = new Date(todayMidnight)
    yesterdayMidnight.setDate(todayMidnight.getDate() - 1)

    await this.prisma.$transaction(async (tx) => {
      await tx.userHabit.updateMany({
        where: {
          createdAt: {
            gte: yesterdayMidnight,
            lt: todayMidnight
          },
          status: HabitStatus.IN_PROGRESS
        },
        data: {
          status: HabitStatus.MISSED
        }
      })

      let dayOfWeek = todayMidnight.getDay()
      dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek

      const habits = await tx.habit.findMany({
        where: {
          weekDays: {
            has: dayOfWeek
          }
        },
        select: {
          id: true
        }
      })

      if (habits.length > 0) {
        await tx.userHabit.createMany({
          data: habits.map((habit) => ({
            habitId: habit.id
          }))
        })
      }
    })
  }

  async getHabits(userId: string, data: GetHabitsDto) {
    const from = new Date(data.from)
    const to = new Date(data.to)

    const userHabits = await this.prisma.userHabit.findMany({
      where: {
        habit: {
          userId
        },
        createdAt: {
          gte: from,
          lte: to
        }
      },
      include: {
        habit: true
      }
    })

    const rangeDates = getRangeDates(from, to)

    const weeklySummary = rangeDates.reduce<Record<number, (UserHabit & { habit: Habit })[]>>((acc, date, index) => {
      const habits = userHabits.filter((userHabit) => dayjs(userHabit.createdAt).isSame(date, 'day'))

      const sortedHabits = [...habits].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      acc[index + 1] = sortedHabits

      return acc
    }, {})

    return weeklySummary
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

      const xpToNextLevel = this.calculateXpForNextLevel(newLevel)

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

      const newRepeats = userHabit.repeats - 1

      const upUserHabit = await tx.userHabit.update({
        where: {
          id: habitId
        },
        data: {
          repeats: newRepeats,
          status: HabitStatus.IN_PROGRESS
        }
      })

      const user = userHabit.habit.user
      let newXp = user.xp.toNumber() - this.XP_PER_HABIT
      let newLevel = user.level.toNumber()

      while (newXp < 0 && newLevel > 0) {
        newLevel--
        const xpForPreviousLevel = this.calculateXpForNextLevel(newLevel)
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

  calculateXpForNextLevel(level: number) {
    return 100 + level * 50
  }
}

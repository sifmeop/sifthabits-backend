import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { GetCurrentUserId } from '~/common/decorators/get-current-user-id'
import { QueryDatesDto } from '~/common/dto/query-dates'
import { CreateHabitDto } from './dto/create-hobit-dto'
import { EditHabitDto } from './dto/edit-hobit-dto'
import { HabitsService } from './habits.service'

@Controller('habits')
export class HabitsController {
  constructor(private readonly habitsService: HabitsService) {}

  @Get()
  async getHabits(@GetCurrentUserId() userId: string, @Query() data: QueryDatesDto) {
    return await this.habitsService.getHabits(userId, data)
  }

  @Post()
  async createHabit(@GetCurrentUserId() userId: string, @Body() body: CreateHabitDto) {
    return await this.habitsService.createHabit(userId, body)
  }

  @Put()
  async updateHabit(@GetCurrentUserId() userId: string, @Body() body: EditHabitDto) {
    return await this.habitsService.updateHabit(userId, body)
  }

  @Delete(':habitId/delete')
  async deleteHabit(@GetCurrentUserId() userId: string, @Param('habitId') habitId: string) {
    return await this.habitsService.deleteHabit(userId, habitId)
  }

  @Put(':habitId/done')
  async completeHabit(@GetCurrentUserId() userId: string, @Param('habitId') habitId: string) {
    return await this.habitsService.markHabitAsDone(userId, habitId)
  }

  @Put(':habitId/undo')
  async undoHabit(@GetCurrentUserId() userId: string, @Param('habitId') habitId: string) {
    return await this.habitsService.undoHabit(userId, habitId)
  }
}

import { Controller, Get, Query } from '@nestjs/common'
import { GetCurrentUserId } from '~/common/decorators/get-current-user-id'
import { QueryDatesDto } from '~/common/dto/query-dates'
import { StatisticsService } from './statistics.service'

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  async getStatistics(@GetCurrentUserId() userId: string, @Query() data: QueryDatesDto) {
    return await this.statisticsService.getStatistics(userId, data)
  }
}

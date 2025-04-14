import { Controller, Get } from '@nestjs/common'
import { IsPublic } from '~/decorators/is-public'

@Controller()
export class AppController {
  @IsPublic()
  @Get()
  async getHealth() {
    return 'OK'
  }
}

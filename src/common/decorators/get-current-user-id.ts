import { createParamDecorator } from '@nestjs/common'

export const GetCurrentUserId = createParamDecorator((_: unknown, ctx) => {
  const request = ctx.switchToHttp().getRequest()
  return request.user.id
})

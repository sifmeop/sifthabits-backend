import { HabitTimeOfDay } from '@prisma/client'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Min,
  MinLength,
  ValidateIf
} from 'class-validator'

export class EditHabitDto {
  @IsUUID()
  id: string

  @IsString()
  @MinLength(1)
  title: string

  @IsNumber()
  @Min(1)
  repeats: number

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  weekDays: number[]

  @IsEnum(HabitTimeOfDay)
  timeOfDay: HabitTimeOfDay

  @ValidateIf((obj) => obj.remindAt !== null)
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'remindAt must be in HH:mm format or null'
  })
  remindAt: string | null
}

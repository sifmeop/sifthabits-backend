import { HabitTimeOfDay } from '@prisma/client'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  MinLength
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
}

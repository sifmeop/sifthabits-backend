import { Type } from 'class-transformer'
import { IsNumber, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'IsValidTimestamp', async: false })
class IsValidTimestampConstraint implements ValidatorConstraintInterface {
  validate(value: number) {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  defaultMessage() {
    return 'Timestamp ($value) is not a valid date'
  }
}

export class GetHabitsDto {
  @Type(() => Number)
  @IsNumber()
  @Validate(IsValidTimestampConstraint)
  from: number

  @Type(() => Number)
  @IsNumber()
  @Validate(IsValidTimestampConstraint)
  to: number
}

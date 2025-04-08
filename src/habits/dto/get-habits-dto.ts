import { IsString, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'IsValidTimestamp', async: false })
class IsValidTimestampConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  defaultMessage() {
    return 'Timestamp ($value) is not a valid date'
  }
}

export class GetHabitsDto {
  @IsString()
  @Validate(IsValidTimestampConstraint)
  from: string

  @IsString()
  @Validate(IsValidTimestampConstraint)
  to: string
}

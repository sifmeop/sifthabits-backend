import dayjs from 'dayjs'

export const getRangeDates = (from: Date, to: Date) => {
  const now = dayjs.utc(from).toDate()
  const dates: Date[] = []

  while (now <= to) {
    dates.push(dayjs.utc(now).toDate())
    now.setDate(now.getDate() + 1)
  }

  return dates
}

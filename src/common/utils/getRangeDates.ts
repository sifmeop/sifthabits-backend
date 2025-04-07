export const getRangeDates = (from: Date, to: Date) => {
  const now = new Date(from)
  const dates = []

  while (now <= to) {
    dates.push(new Date(now))
    now.setDate(now.getDate() + 1)
  }

  return dates
}

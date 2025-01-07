export class TimezoneService {
  static TIMEZONE = "Asia/Kolkata"

  static getCurrentTimestamp() {
    const now = new Date()

    const indianTime = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now)

    const parts = Object.fromEntries(indianTime.map((p) => [p.type, p.value]))
    const indianDateStr = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`

    const indianDate = new Date(indianDateStr)

    if (isNaN(indianDate.getTime())) {
      return Math.floor(now.getTime() / 1000)
    }

    return Math.floor(indianDate.getTime() / 1000)
  }

  static getDayRange(unixTimestamp = null) {
    const baseDate = unixTimestamp ? new Date(unixTimestamp * 1000) : new Date()

    const indianTime = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(baseDate)

    const parts = Object.fromEntries(indianTime.map((p) => [p.type, p.value]))

    const startOfDayString = `${parts.year}-${parts.month}-${parts.day}T00:00:00`
    const endOfDayString = `${parts.year}-${parts.month}-${parts.day}T23:59:59.999`

    const start = new Date(
      new Date(startOfDayString).toLocaleString("en-US", {
        timeZone: this.TIMEZONE,
      })
    )
    const end = new Date(
      new Date(endOfDayString).toLocaleString("en-US", {
        timeZone: this.TIMEZONE,
      })
    )

    return {
      startOfDay: Math.floor(start.getTime() / 1000),
      endOfDay: Math.floor(end.getTime() / 1000),
    }
  }

  static getSecondsRemainingToday() {
    const now = this.getCurrentTimestamp()
    const { endOfDay } = this.getDayRange()
    return endOfDay - now
  }

  static formatDate(unixTimestamp) {
    if (isNaN(unixTimestamp)) {
      throw new Error("Invalid timestamp provided.")
    }

    return new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(new Date(unixTimestamp * 1000))
  }

  static getSecondsUntilNextDayTargetTime(hour = 23, minute = 30) {
    const now = new Date()

    // Get next day's date in the "Asia/Kolkata" timezone
    const indianTime = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now)

    const parts = Object.fromEntries(indianTime.map((p) => [p.type, p.value]))
    const nextDay = new Date(
      `${parts.year}-${parts.month}-${parseInt(parts.day) + 1}T${hour
        .toString()
        .padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00+05:30`
    )

    const nowTimestamp = this.getCurrentTimestamp()
    const targetTimestamp = Math.floor(nextDay.getTime() / 1000)

    return targetTimestamp - nowTimestamp
  }
}

// Usage
const secondsRemaining = TimezoneService.getSecondsUntilNextDayTargetTime(
  23,
  30
)
console.log("Seconds remaining until next day's 23:30:", secondsRemaining)

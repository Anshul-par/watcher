export class TimezoneService {
  static TIMEZONE = "Asia/Kolkata";

  static getCurrentTimestamp() {
    const now = new Date();

    const indianTime = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const parts = Object.fromEntries(indianTime.map((p) => [p.type, p.value]));
    const indianDate = new Date(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`
    );

    return Math.floor(indianDate.getTime() / 1000); // Return UNIX timestamp
  }

  static getDayRange(unixTimestamp = null) {
    // If a timestamp is provided, use it; otherwise, use the current time
    const baseDate = unixTimestamp
      ? new Date(unixTimestamp * 1000)
      : new Date();

    const indianTime = new Intl.DateTimeFormat("en-US", {
      timeZone: this.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(baseDate);

    const parts = Object.fromEntries(indianTime.map((p) => [p.type, p.value]));

    const startOfDayString = `${parts.year}-${parts.month}-${parts.day}T00:00:00`;
    const endOfDayString = `${parts.year}-${parts.month}-${parts.day}T23:59:59.999`;

    const start = new Date(
      new Date(startOfDayString).toLocaleString("en-US", {
        timeZone: this.TIMEZONE,
      })
    );
    const end = new Date(
      new Date(endOfDayString).toLocaleString("en-US", {
        timeZone: this.TIMEZONE,
      })
    );

    return {
      startOfDay: Math.floor(start.getTime() / 1000), // Convert to UNIX timestamp
      endOfDay: Math.floor(end.getTime() / 1000), // Convert to UNIX timestamp
    };
  }

  static getSecondsRemainingToday() {
    const now = this.getCurrentTimestamp();
    const { endOfDay } = this.getDayRange();
    return endOfDay - now;
  }

  static formatDate(unixTimestamp) {
    if (isNaN(unixTimestamp)) {
      throw new Error("Invalid timestamp provided.");
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
    }).format(new Date(unixTimestamp * 1000));
  }
}

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export class TimezoneService {
  private static readonly TIMEZONE = "Asia/Kolkata";
  private static readonly SECONDS_IN_DAY = 86400;
  private static readonly FALLBACK_TIMESTAMP = Math.floor(Date.now() / 1000);

  /**
   * Gets current Unix timestamp in seconds for Asia/Kolkata timezone
   * @returns number Unix timestamp in seconds
   */
  static getCurrentTimestamp(): number {
    try {
      return Math.floor(dayjs().tz(this.TIMEZONE).valueOf() / 1000);
    } catch {
      return this.FALLBACK_TIMESTAMP;
    }
  }

  /**
   * Gets the start and end timestamps of a day for a given Unix timestamp
   * If no timestamp is provided, uses current time
   * @param unixTimestamp Optional Unix timestamp in seconds
   * @returns Object containing startOfDay and endOfDay timestamps
   */
  static getDayRange(unixTimestamp?: number): {
    startOfDay: number;
    endOfDay: number;
  } {
    try {
      const date = unixTimestamp
        ? dayjs.unix(unixTimestamp).tz(this.TIMEZONE)
        : dayjs().tz(this.TIMEZONE);

      return {
        startOfDay: Math.floor(date.startOf("day").valueOf() / 1000),
        endOfDay: Math.floor(date.endOf("day").valueOf() / 1000),
      };
    } catch {
      // Fallback: return current day range based on current timestamp
      const now = this.FALLBACK_TIMESTAMP;
      return {
        startOfDay: now,
        endOfDay: now + this.SECONDS_IN_DAY,
      };
    }
  }

  /**
   * Gets number of seconds remaining in current day in Asia/Kolkata timezone
   * @returns number Seconds remaining in current day
   */
  static getSecondsRemainingToday(): number {
    try {
      const now = dayjs().tz(this.TIMEZONE);
      const endOfDayAt23 = now
        .set("hour", 23)
        .set("minute", 0)
        .set("second", 0)
        .set("millisecond", 0);
      const remaining = endOfDayAt23.diff(now, "second");
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Gets seconds until next occurrence of specified time
   * If the time hasn't passed today, will use today's time instead of tomorrow
   * @param hour Hour in 24-hour format (0-23)
   * @param minute Minute (0-59)
   * @returns number Seconds until next occurrence of specified time
   */
  static getSecondsUntilNextDayTargetTime(
    hour: number = 23,
    minute: number = 0
  ): number {
    try {
      // Validate input parameters
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return this.SECONDS_IN_DAY;
      }

      const now = dayjs().tz(this.TIMEZONE);

      // Create target time for today
      const todayTarget = now.hour(hour).minute(minute).second(0);

      if (todayTarget.isAfter(now)) {
        // If the target time today hasn't passed, calculate difference from now to todayTarget
        return todayTarget.diff(now, "second");
      } else {
        // Otherwise, use tomorrow's target time
        const tomorrowTarget = todayTarget.add(1, "day");
        return tomorrowTarget.diff(now, "second");
      }
    } catch {
      return this.SECONDS_IN_DAY;
    }
  }

  /**
   * Converts a Unix timestamp to a well-formatted date string
   * @param timestamp Unix timestamp in seconds
   * @returns string Formatted date (e.g., "Mon, YYYY-MM-DD HH:mm:ss")
   */
  static formatUnixTimestamp(timestamp: number): string {
    try {
      if (typeof timestamp !== "number" || timestamp < 0) {
        throw new Error("Invalid timestamp");
      }

      return dayjs
        .unix(timestamp)
        .tz(this.TIMEZONE)
        .format("ddd, YYYY-MM-DD HH:mm:ss");
    } catch {
      return "Invalid date";
    }
  }
}

// Test 1: getCurrentTimestamp
console.log("\n=== Testing getCurrentTimestamp ===");
const currentTimestamp = TimezoneService.getCurrentTimestamp();
console.log("Current timestamp:", currentTimestamp);
console.log(
  "Converted to IST:",
  dayjs.unix(currentTimestamp).tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss")
);

// Test 2: getDayRange
console.log("\n=== Testing getDayRange ===");
const dayRange = TimezoneService.getDayRange();
console.log("Day range:", {
  startOfDay: {
    timestamp: dayRange.startOfDay,
    formatted: dayjs
      .unix(dayRange.startOfDay)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss"),
  },
  endOfDay: {
    timestamp: dayRange.endOfDay,
    formatted: dayjs
      .unix(dayRange.endOfDay)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss"),
  },
});

// Test 3: getSecondsRemainingToday
console.log("\n=== Testing getSecondsRemainingToday ===");
const remainingSeconds = TimezoneService.getSecondsRemainingToday();
console.log("Seconds remaining today:", remainingSeconds);
console.log("In hours and minutes:", {
  hours: Math.floor(remainingSeconds / 3600),
  minutes: Math.floor((remainingSeconds % 3600) / 60),
  seconds: remainingSeconds % 60,
});

// Test 4: getSecondsUntilNextDayTargetTime
console.log("\n=== Testing getSecondsUntilNextDayTargetTime ===");
const targetHour = 23;
const targetMinute = 0;
const secondsUntilTarget = TimezoneService.getSecondsUntilNextDayTargetTime(
  targetHour,
  targetMinute
);
console.log(`Seconds until ${targetHour}:${targetMinute}:`, secondsUntilTarget);
console.log("In hours and minutes:", {
  hours: Math.floor(secondsUntilTarget / 3600),
  minutes: Math.floor((secondsUntilTarget % 3600) / 60),
  seconds: secondsUntilTarget % 60,
});

// Additional test with custom timestamp
console.log("\n=== Testing getDayRange with custom timestamp ===");
const customTimestamp = TimezoneService.getCurrentTimestamp() + 86400; // Tomorrow
const tomorrowRange = TimezoneService.getDayRange(customTimestamp);
console.log("Tomorrow's range:", {
  startOfDay: {
    timestamp: tomorrowRange.startOfDay,
    formatted: dayjs
      .unix(tomorrowRange.startOfDay)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss"),
  },
  endOfDay: {
    timestamp: tomorrowRange.endOfDay,
    formatted: dayjs
      .unix(tomorrowRange.endOfDay)
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss"),
  },
});

// Test 5: formatUnixTimestamp

console.log("\n=== Testing formatUnixTimestamp ===");
const formattedTimestamp =
  TimezoneService.formatUnixTimestamp(currentTimestamp);
console.log("Formatted timestamp:", formattedTimestamp);
const invalidTimestamp = TimezoneService.formatUnixTimestamp(-1);
console.log("Invalid timestamp:", invalidTimestamp);
const futureTimestamp = TimezoneService.formatUnixTimestamp(
  currentTimestamp + 86400
);
console.log("Future timestamp:", futureTimestamp);

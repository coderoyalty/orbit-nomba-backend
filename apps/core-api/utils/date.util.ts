import { Interval } from '@app/database';

export class DateUtils {
  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static calculatePeriodEnd(
    start: Date,
    interval: Interval,
    count: number,
  ): Date {
    const end = new Date(start);

    switch (interval) {
      case 'day':
        end.setDate(end.getDate() + count);
        break;

      case 'week':
        end.setDate(end.getDate() + count * 7);
        break;

      case 'month':
        end.setMonth(end.getMonth() + count);
        break;

      case 'year':
        end.setFullYear(end.getFullYear() + count);
        break;
    }

    return end;
  }
}

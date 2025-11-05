export function getYesterdayDate(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
}

export function getWeekStartDate(date: Date): Date {
  const day = date.getDay();
  // Convert Sunday (0) to 7, Monday (1) to 1, etc.
  const dayOfWeek = day === 0 ? 7 : day;
  const diff = date.getDate() - dayOfWeek + 1; // +1 to get Monday
  const weekStart = new Date(date);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export function getMonthStartDate(date: Date): Date {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
}

export function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
  return Math.max(1, daysDiff); // At least 1 day
}

export function calculateScaledTargets(monthlyTarget: number): {
  ytdTarget: number;
  wtdTarget: number;
  mtdTarget: number;
} {
  const yesterday = getYesterdayDate();
  const weekStart = getWeekStartDate(yesterday);
  const monthStart = getMonthStartDate(yesterday);
  const daysInMonth = getDaysInMonth(yesterday);
  
  // Calculate days passed for each period
  const ytdDays = 1; // Yesterday only
  const wtdDays = getDaysBetween(weekStart, yesterday);
  const mtdDays = getDaysBetween(monthStart, yesterday);
  
  // Calculate daily target (assuming 26 working days in a month)
  const dailyTarget = monthlyTarget / 26;
  
  // Calculate scaled targets
  const ytdTarget = dailyTarget * ytdDays;
  const wtdTarget = dailyTarget * wtdDays;
  const mtdTarget = (monthlyTarget / daysInMonth) * mtdDays;
  
  return {
    ytdTarget: Math.round(ytdTarget),
    wtdTarget: Math.round(wtdTarget),
    mtdTarget: Math.round(mtdTarget)
  };
}

// Utility function to get current scaling info for debugging
export function getCurrentScalingInfo() {
  const yesterday = getYesterdayDate();
  const weekStart = getWeekStartDate(yesterday);
  const monthStart = getMonthStartDate(yesterday);
  const daysInMonth = getDaysInMonth(yesterday);
  
  const wtdDays = getDaysBetween(weekStart, yesterday);
  const mtdDays = getDaysBetween(monthStart, yesterday);
  
  return {
    yesterday: yesterday.toDateString(),
    weekStart: weekStart.toDateString(),
    monthStart: monthStart.toDateString(),
    daysInMonth,
    wtdDays,
    mtdDays
  };
}
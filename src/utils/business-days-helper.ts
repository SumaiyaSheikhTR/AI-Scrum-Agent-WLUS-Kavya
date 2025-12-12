/**
 * Helper functions for business day calculations
 */
export const businessDaysHelper = {
  /**
   * Helper method to count business days between two dates, excluding weekends and team days off
   * @param startDate The start date
   * @param endDate The end date
   * @param teamDaysOff Optional array of dates that the team has off (holidays, team events, etc.)
   * @returns The number of business days
   */
  getBusinessDayCount: (startDate: Date, endDate: Date, teamDaysOff: Date[] = []): number => {
    let count = 0;
    const currentDate = new Date(startDate);
    
    // Convert teamDaysOff to timestamp strings for easier comparison
    const daysOffTimestamps = teamDaysOff.map(date => 
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    );
    
    // Adjust start date if it's a weekend
    if (currentDate.getDay() === 0) { // Sunday
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (currentDate.getDay() === 6) { // Saturday
      currentDate.setDate(currentDate.getDate() + 2);
    }
    
    // Count business days
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const currentTimestamp = new Date(
        currentDate.getFullYear(), 
        currentDate.getMonth(), 
        currentDate.getDate()
      ).getTime();
      
      // Check if it's a weekday and not a team day off
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !daysOffTimestamps.includes(currentTimestamp)) {
        count++;
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  },
  
  /**
   * Gets the remaining business days in a sprint
   * @param sprintEndDate The end date of the sprint
   * @param teamDaysOff Optional array of dates that the team has off
   * @returns The number of remaining business days
   */
  getRemainingBusinessDays: (sprintEndDate: Date, teamDaysOff: Date[] = []): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (today > sprintEndDate) {
      return 0;
    }
    
    return businessDaysHelper.getBusinessDayCount(today, sprintEndDate, teamDaysOff);
  },
  
  /**
   * Checks if a given date is a business day
   * @param date The date to check
   * @param teamDaysOff Optional array of dates that the team has off
   * @returns True if the date is a business day
   */
  isBusinessDay: (date: Date, teamDaysOff: Date[] = []): boolean => {
    const dayOfWeek = date.getDay();
    
    // Check if it's a weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // Check if it's a team day off
    const dateTimestamp = new Date(
      date.getFullYear(), 
      date.getMonth(), 
      date.getDate()
    ).getTime();
    
    const isDayOff = teamDaysOff.some(teamDayOff => {
      const teamDayOffTimestamp = new Date(
        teamDayOff.getFullYear(), 
        teamDayOff.getMonth(), 
        teamDayOff.getDate()
      ).getTime();
      
      return dateTimestamp === teamDayOffTimestamp;
    });
    
    return !isDayOff;
  }
};

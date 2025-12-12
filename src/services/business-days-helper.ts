/**
 * Helper functions for business day calculations
 */
export const businessDaysHelper = {
  /**
   * Helper method to count business days between two dates
   * @param startDate The start date
   * @param endDate The end date
   * @returns The number of business days
   */
  getBusinessDayCount: (startDate: Date, endDate: Date): number => {
    let count = 0;
    const currentDate = new Date(startDate);
    
    // Adjust start date if it's a weekend
    if (currentDate.getDay() === 0) { // Sunday
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (currentDate.getDay() === 6) { // Saturday
      currentDate.setDate(currentDate.getDate() + 2);
    }
    
    // Count business days
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return count;
  }
};

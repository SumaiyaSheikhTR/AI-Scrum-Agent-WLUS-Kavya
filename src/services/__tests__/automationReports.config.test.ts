import automationReportsService from '../automationReportsService';

describe('AutomationReportsService config', () => {
  test('defaults enable developer reminders, velocity, and sentiment', () => {
    // Reset to known defaults via updateConfig
    automationReportsService.updateConfig({
      developerReminders: {
        enabled: true,
        staleDays: 2,
        includeBacklogAssigned: true,
        channels: ['ado', 'console'],
        cooldownHours: 24,
      },
      velocityReport: {
        enabled: true,
        dailyTime: '09:30',
        includeWeekends: false,
        managerEmails: [],
        channels: ['email', 'console'],
        historicalSprints: 3,
      },
      sentimentDigest: {
        enabled: true,
        managerEmails: [],
        channels: ['email', 'console'],
        negativeThreshold: -0.2,
        alwaysSendDigest: true,
      },
    });

    const config = automationReportsService.getConfig();
    expect(config.developerReminders.enabled).toBe(true);
    expect(config.velocityReport.enabled).toBe(true);
    expect(config.sentimentDigest.enabled).toBe(true);
    expect(config.developerReminders.channels).toContain('ado');
    expect(config.velocityReport.channels).toContain('email');
    expect(config.sentimentDigest.channels).toContain('email');
  });

  test('updateConfig merges nested sections without wiping others', () => {
    automationReportsService.updateConfig({
      velocityReport: {
        ...automationReportsService.getConfig().velocityReport,
        managerEmails: ['mgr@example.com'],
        dailyTime: '10:15',
      },
    });

    const config = automationReportsService.getConfig();
    expect(config.velocityReport.managerEmails).toEqual(['mgr@example.com']);
    expect(config.velocityReport.dailyTime).toBe('10:15');
    expect(config.developerReminders.enabled).toBe(true);
    expect(config.sentimentDigest.enabled).toBe(true);
  });
});

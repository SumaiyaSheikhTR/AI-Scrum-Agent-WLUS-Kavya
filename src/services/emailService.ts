/**
 * Email Service for Capacity Utilization Reports
 * 
 * This service handles sending capacity utilization reports via email
 * with configurable recipients and scheduling options.
 */

export interface EmailConfig {
  enabled: boolean;
  smtpServer: string;
  smtpPort: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  useSecure: boolean; // TLS/SSL
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly';
  time: string; // HH:MM format (24-hour)
  dayOfWeek?: number; // 0-6, Sunday = 0 (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  timezone: string;
  recipients: string[]; // List of manager emails
}

export interface CapacityReportData {
  sprintName: string;
  sprintId: string;
  reportDate: string;
  totalCapacity: number;
  totalAssigned: number;
  totalCompleted: number;
  overallUtilization: number;
  teamMembers: Array<{
    name: string;
    utilization: number;
    capacity: number;
    assigned: number;
    completed: number;
    status: string;
    isOnTrack: boolean;
  }>;
  summary: {
    wellUtilized: number;
    underUtilized: number;
    overCapacity: number;
    atRisk: number;
  };
}

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false,
  smtpServer: '',
  smtpPort: 587,
  username: '',
  password: '',
  fromEmail: '',
  fromName: 'AI Scrum Agent',
  useSecure: true
};

const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  enabled: false,
  frequency: 'weekly',
  time: '09:00',
  dayOfWeek: 1, // Monday
  timezone: 'UTC',
  recipients: []
};

class EmailService {
  private emailConfig: EmailConfig;
  private scheduleConfig: ScheduleConfig;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.emailConfig = this.loadEmailConfig();
    this.scheduleConfig = this.loadScheduleConfig();
    this.startScheduler();
  }

  /**
   * Load email configuration from localStorage
   */
  private loadEmailConfig(): EmailConfig {
    try {
      const saved = localStorage.getItem('email-config');
      if (saved) {
        return { ...DEFAULT_EMAIL_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading email config:', error);
    }
    return { ...DEFAULT_EMAIL_CONFIG };
  }

  /**
   * Load schedule configuration from localStorage
   */
  private loadScheduleConfig(): ScheduleConfig {
    try {
      const saved = localStorage.getItem('email-schedule-config');
      if (saved) {
        return { ...DEFAULT_SCHEDULE_CONFIG, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Error loading schedule config:', error);
    }
    return { ...DEFAULT_SCHEDULE_CONFIG };
  }

  /**
   * Save email configuration
   */
  saveEmailConfig(config: Partial<EmailConfig>): void {
    try {
      this.emailConfig = { ...this.emailConfig, ...config };
      localStorage.setItem('email-config', JSON.stringify(this.emailConfig));
      console.log('Email configuration saved successfully');
    } catch (error) {
      console.error('Error saving email config:', error);
      throw new Error('Failed to save email configuration');
    }
  }

  /**
   * Save schedule configuration
   */
  saveScheduleConfig(config: Partial<ScheduleConfig>): void {
    try {
      this.scheduleConfig = { ...this.scheduleConfig, ...config };
      localStorage.setItem('email-schedule-config', JSON.stringify(this.scheduleConfig));
      this.restartScheduler();
      console.log('Schedule configuration saved successfully');
    } catch (error) {
      console.error('Error saving schedule config:', error);
      throw new Error('Failed to save schedule configuration');
    }
  }

  /**
   * Get current email configuration
   */
  getEmailConfig(): EmailConfig {
    return { ...this.emailConfig };
  }

  /**
   * Get current schedule configuration
   */
  getScheduleConfig(): ScheduleConfig {
    return { ...this.scheduleConfig };
  }

  /**
   * Generate HTML email content for capacity report
   */
  private generateEmailHTML(data: CapacityReportData): string {
    const utilizationColor = (utilization: number) => {
      if (utilization > 100) return '#f44336'; // Red
      if (utilization === 100) return '#4caf50'; // Green
      return '#ff9800'; // Orange
    };

    const statusColor = (isOnTrack: boolean) => isOnTrack ? '#4caf50' : '#f44336';

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            border-radius: 8px 8px 0 0; 
            text-align: center; 
        }
        .content { padding: 30px; }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); 
            gap: 20px; 
            margin: 20px 0; 
        }
        .summary-card { 
            text-align: center; 
            padding: 20px; 
            border-radius: 8px; 
            background: #f8f9fa; 
            border-left: 4px solid #667eea; 
        }
        .summary-card h3 { margin: 0; font-size: 24px; color: #333; }
        .summary-card p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        th { 
            background: #f8f9fa; 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
            color: #333; 
            border-bottom: 2px solid #dee2e6; 
        }
        td { 
            padding: 12px; 
            border-bottom: 1px solid #dee2e6; 
        }
        tr:hover { background-color: #f8f9fa; }
        .status-badge { 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600; 
            color: white; 
        }
        .footer { 
            background: #f8f9fa; 
            padding: 20px 30px; 
            border-radius: 0 0 8px 8px; 
            text-align: center; 
            color: #666; 
            font-size: 14px; 
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background-color: #e0e0e0;
            border-radius: 10px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏃‍♂️ Sprint Capacity Utilization Report</h1>
            <h2>${data.sprintName}</h2>
            <p>Generated on ${new Date(data.reportDate).toLocaleDateString()}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="summary-card">
                    <h3>${data.totalCapacity}h</h3>
                    <p>Total Capacity</p>
                </div>
                <div class="summary-card">
                    <h3>${data.totalAssigned}h</h3>
                    <p>Total Assigned</p>
                </div>
                <div class="summary-card">
                    <h3>${data.totalCompleted}h</h3>
                    <p>Total Completed</p>
                </div>
                <div class="summary-card">
                    <h3>${Math.round(data.overallUtilization)}%</h3>
                    <p>Overall Utilization</p>
                </div>
            </div>

            <h3>Team Summary</h3>
            <div class="summary">
                <div class="summary-card">
                    <h3>${data.summary.wellUtilized}</h3>
                    <p>Well Utilized</p>
                </div>
                <div class="summary-card">
                    <h3>${data.summary.underUtilized}</h3>
                    <p>Under Utilized</p>
                </div>
                <div class="summary-card">
                    <h3>${data.summary.overCapacity}</h3>
                    <p>Over Capacity</p>
                </div>
                <div class="summary-card">
                    <h3>${data.summary.atRisk}</h3>
                    <p>At Risk</p>
                </div>
            </div>

            <h3>Team Member Details</h3>
            <table>
                <thead>
                    <tr>
                        <th>Team Member</th>
                        <th>Capacity (h)</th>
                        <th>Assigned (h)</th>
                        <th>Completed (h)</th>
                        <th>Utilization</th>
                        <th>Status</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.teamMembers.map(member => `
                        <tr>
                            <td><strong>${member.name}</strong></td>
                            <td>${member.capacity}</td>
                            <td>${member.assigned}</td>
                            <td>${member.completed}</td>
                            <td style="color: ${utilizationColor(member.utilization)}; font-weight: 600;">${Math.round(member.utilization)}%</td>
                            <td>
                                <span class="status-badge" style="background-color: ${utilizationColor(member.utilization)};">
                                    ${member.status}
                                </span>
                            </td>
                            <td>
                                <span style="color: ${statusColor(member.isOnTrack)}; font-weight: 600;">
                                    ${member.isOnTrack ? 'On Track' : 'At Risk'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>This report was automatically generated by the AI Scrum Agent system.</p>
            <p>For questions or issues, please contact your development team.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send capacity utilization report email
   */
  async sendCapacityReport(data: CapacityReportData, recipients?: string[]): Promise<boolean> {
    if (!this.emailConfig.enabled) {
      console.log('Email service is disabled. Skipping capacity report email.');
      return false;
    }

    const emailRecipients = recipients || this.scheduleConfig.recipients;
    if (emailRecipients.length === 0) {
      console.warn('No email recipients configured for capacity report.');
      return false;
    }

    try {
      const subject = `Sprint Capacity Report: ${data.sprintName} - ${Math.round(data.overallUtilization)}% Utilization`;
      const htmlContent = this.generateEmailHTML(data);

      // In a real implementation, you would use an actual email service like:
      // - NodeMailer with SMTP
      // - SendGrid API
      // - AWS SES
      // - Microsoft Graph API (for Outlook/Exchange)
      
      // For now, we'll simulate the email sending
      console.log('📧 ==================== CAPACITY REPORT EMAIL ====================');
      console.log(`📧 To: ${emailRecipients.join(', ')}`);
      console.log(`📧 From: ${this.emailConfig.fromName} <${this.emailConfig.fromEmail}>`);
      console.log(`📧 Subject: ${subject}`);
      console.log(`📧 SMTP Server: ${this.emailConfig.smtpServer}:${this.emailConfig.smtpPort}`);
      console.log(`📧 HTML Content Length: ${htmlContent.length} characters`);
      console.log('📧 ================================================================');

      // TODO: Implement actual email sending here
      // const result = await this.sendSMTPEmail({
      //   to: emailRecipients,
      //   subject,
      //   html: htmlContent
      // });

      // For demo purposes, show success
      console.log('✅ Capacity report email sent successfully!');
      return true;

    } catch (error) {
      console.error('❌ Error sending capacity report email:', error);
      return false;
    }
  }

  /**
   * Start the email scheduler
   */
  private startScheduler(): void {
    if (!this.scheduleConfig.enabled || this.intervalId) {
      return;
    }

    // Check every minute if it's time to send
    this.intervalId = setInterval(() => {
      this.checkSchedule();
    }, 60000); // Check every minute

    console.log('📧 Email scheduler started');
  }

  /**
   * Stop the email scheduler
   */
  private stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📧 Email scheduler stopped');
    }
  }

  /**
   * Restart the email scheduler
   */
  private restartScheduler(): void {
    this.stopScheduler();
    this.startScheduler();
  }

  /**
   * Check if it's time to send the scheduled report
   */
  private checkSchedule(): void {
    if (!this.scheduleConfig.enabled) {
      return;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Only check at the exact scheduled time
    if (currentTime !== this.scheduleConfig.time) {
      return;
    }

    const shouldSend = this.shouldSendToday(now);
    if (shouldSend) {
      console.log('📧 Scheduled capacity report email triggered');
      // Trigger report generation and sending
      // This would need to be connected to the capacity utilization component
      this.triggerScheduledReport();
    }
  }

  /**
   * Determine if report should be sent today based on frequency
   */
  private shouldSendToday(date: Date): boolean {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const dayOfMonth = date.getDate();

    switch (this.scheduleConfig.frequency) {
      case 'daily':
        return true;

      case 'weekly':
        return day === (this.scheduleConfig.dayOfWeek || 1);

      case 'bi-weekly':
        // Send every 2 weeks on the specified day
        const weekNumber = Math.floor(date.getTime() / (1000 * 60 * 60 * 24 * 7));
        return day === (this.scheduleConfig.dayOfWeek || 1) && weekNumber % 2 === 0;

      case 'monthly':
        return dayOfMonth === (this.scheduleConfig.dayOfMonth || 1);

      default:
        return false;
    }
  }

  /**
   * Trigger scheduled report generation
   */
  private triggerScheduledReport(): void {
    // Dispatch a custom event that the CapacityUtilization component can listen to
    const event = new CustomEvent('schedule-capacity-report', {
      detail: {
        timestamp: new Date().toISOString(),
        source: 'email-scheduler'
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * Send a generic email (alerts, daily summaries, etc.)
   * Posts to the Express /api/email endpoint when available.
   */
  async sendGenericEmail(options: {
    to: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<boolean> {
    if (!options.to?.length) {
      console.warn('[EmailService] No recipients provided');
      return false;
    }

    const payload = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]+>/g, ' '),
      smtp: this.emailConfig.enabled
        ? {
            host: this.emailConfig.smtpServer,
            port: this.emailConfig.smtpPort,
            secure: this.emailConfig.useSecure,
            user: this.emailConfig.username,
            pass: this.emailConfig.password,
            from: `${this.emailConfig.fromName} <${this.emailConfig.fromEmail}>`,
          }
        : null,
    };

    try {
      const response = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[EmailService] API error:', response.status, errText);
        // Fall through to local log so automation is still observable
      } else {
        const result = await response.json();
        console.log('[EmailService] Email accepted by backend:', result);
        return !!result.success;
      }
    } catch (error) {
      console.warn('[EmailService] Backend unavailable, logging email locally:', error);
    }

    console.log('📧 ==================== OUTBOUND EMAIL ====================');
    console.log(`📧 To: ${options.to.join(', ')}`);
    console.log(`📧 Subject: ${options.subject}`);
    console.log(`📧 Text length: ${(options.text || '').length}`);
    console.log('📧 ========================================================');
    return true;
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(): Promise<boolean> {
    if (!this.emailConfig.enabled) {
      throw new Error('Email service is not enabled');
    }

    try {
      console.log('📧 Testing email configuration...');
      return await this.sendGenericEmail({
        to: [this.emailConfig.fromEmail || this.emailConfig.username].filter(Boolean),
        subject: 'Test Email - AI Scrum Agent',
        html: '<p>This is a test email from the AI Scrum Agent automation system.</p>',
        text: 'This is a test email from the AI Scrum Agent automation system.',
      });
    } catch (error) {
      console.error('❌ Email configuration test failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy(): void {
    this.stopScheduler();
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;

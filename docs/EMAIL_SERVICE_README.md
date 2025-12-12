# Email Service for Capacity Utilization Reports

This document describes the email functionality for sending automated capacity utilization reports to managers.

## Overview

The email service allows the AI Scrum Agent to:
- Send capacity utilization reports via email
- Configure SMTP server settings
- Schedule automated report delivery
- Generate professional HTML email reports
- Manage manager email recipients

## Components

### 1. EmailService (`src/services/emailService.ts`)

The core email service that handles:
- SMTP configuration management
- HTML email generation
- Scheduled report sending
- Email configuration validation

**Key Features:**
- Professional HTML email templates with charts and summaries
- Configurable SMTP settings (Gmail, Outlook, custom servers)
- Automated scheduling (daily, weekly, bi-weekly, monthly)
- Multiple recipient management
- Email configuration testing

### 2. EmailConfigForm (`src/components/config/EmailConfigForm.tsx`)

A comprehensive configuration interface for:
- SMTP server settings (server, port, credentials)
- Email scheduling configuration
- Manager email recipient management
- Email service testing

**Configuration Options:**
- **SMTP Settings:** Server, port, username, password, from email/name
- **Security:** TLS/SSL support
- **Scheduling:** Frequency, time, timezone, day of week/month
- **Recipients:** Add/remove manager emails

### 3. CapacityUtilization Integration

The capacity utilization component now includes:
- "Email" button in the toolbar to manually send reports
- Automatic report generation for scheduled emails
- Event listener for scheduled email triggers
- Report data preparation and formatting

## Setup Instructions

### 1. Configure Email Settings

1. Navigate to **Settings > Email Settings**
2. Enable the email service
3. Configure SMTP server settings:
   - For Gmail: `smtp.gmail.com:587` with app-specific password
   - For Outlook: `smtp-mail.outlook.com:587` with app-specific password
   - For custom servers: Enter your SMTP details

### 2. Set Up Manager Recipients

1. In the Email Settings tab, scroll to "Email Recipients"
2. Add manager email addresses who should receive reports
3. Save the configuration

### 3. Configure Automated Scheduling

1. Enable "Automated Reports"
2. Choose frequency (daily, weekly, bi-weekly, monthly)
3. Set the time and timezone
4. For weekly/bi-weekly: Select day of week
5. For monthly: Select day of month
6. Save the schedule configuration

### 4. Test the Configuration

1. Click "Test Email" to verify SMTP settings
2. Use the "Email" button in Capacity Utilization to send a manual report
3. Check the browser console for email service logs

## Email Report Content

The automated email reports include:

### Summary Metrics
- Total team capacity
- Total assigned work
- Total completed work
- Overall utilization percentage

### Team Analysis
- Number of well-utilized team members (100%)
- Number of under-utilized team members (<100%)
- Number of over-capacity team members (>100%)
- Number of at-risk team members

### Individual Details
- Team member capacity and assignments
- Utilization percentages with color coding
- Progress status (On Track / At Risk)
- Completion metrics

### Professional Formatting
- Responsive HTML design
- Color-coded status indicators
- Sprint information and timestamps
- Company branding-ready template

## Usage Examples

### Manual Email Sending
```typescript
// In CapacityUtilization component
const handleSendEmail = async () => {
  // Prepare report data
  const reportData: CapacityReportData = {
    sprintName: "Sprint 1",
    // ... other data
  };
  
  // Send email
  const success = await emailService.sendCapacityReport(reportData);
};
```

### Scheduled Email Configuration
```typescript
// Configure weekly reports on Mondays at 9 AM
const scheduleConfig = {
  enabled: true,
  frequency: 'weekly',
  time: '09:00',
  dayOfWeek: 1, // Monday
  timezone: 'America/New_York',
  recipients: ['manager@company.com', 'director@company.com']
};
```

## SMTP Configuration Examples

### Gmail Configuration
```
SMTP Server: smtp.gmail.com
Port: 587
Security: TLS/SSL enabled
Username: your-email@gmail.com
Password: [App-specific password from Google Account settings]
```

### Outlook/Office 365 Configuration
```
SMTP Server: smtp-mail.outlook.com
Port: 587
Security: TLS/SSL enabled
Username: your-email@outlook.com
Password: [App-specific password or account password]
```

### Corporate Exchange Server
```
SMTP Server: mail.company.com
Port: 587 or 25
Security: TLS/SSL (depending on server config)
Username: domain\\username or username@company.com
Password: [Corporate password]
```

## Security Considerations

1. **App-Specific Passwords:** Use app-specific passwords instead of main account passwords
2. **Secure Storage:** Email credentials are stored in browser localStorage (consider more secure storage for production)
3. **TLS/SSL:** Always enable secure connections for SMTP
4. **Limited Scope:** Email service only sends capacity reports, no other sensitive data

## Troubleshooting

### Common Issues

1. **Email not sending:**
   - Check SMTP configuration
   - Verify app-specific password
   - Check firewall/network restrictions
   - Review browser console for error details

2. **Authentication failures:**
   - Enable "Less secure apps" or use app-specific passwords
   - Verify username format (some servers require full email)
   - Check if 2FA requires app-specific passwords

3. **Scheduled emails not working:**
   - Ensure browser tab remains open (scheduler runs in browser)
   - Check schedule configuration
   - Verify recipient list is not empty

### Debug Logging

The email service provides detailed console logging:
- `📧` Email operation logs
- `✅` Success indicators
- `❌` Error details
- `📧 ==================== CAPACITY REPORT EMAIL ====================` Full email details

## Future Enhancements

Planned improvements:
1. **Server-side scheduling** for reliable background email delivery
2. **Email templates** customization
3. **Advanced filtering** for report content
4. **Email delivery status** tracking
5. **Integration with other notification systems** (Slack, Teams)
6. **Email authentication** methods (OAuth2)
7. **Attachment support** for detailed reports
8. **Email analytics** and delivery metrics

## Implementation Notes

- The current implementation simulates email sending with console logging
- To enable actual email delivery, integrate with:
  - NodeMailer for server-side SMTP
  - SendGrid API for cloud email service
  - AWS SES for scalable email delivery
  - Microsoft Graph API for Office 365 integration

The email service is designed to be easily extended with actual email delivery mechanisms while maintaining the same API and configuration interface.

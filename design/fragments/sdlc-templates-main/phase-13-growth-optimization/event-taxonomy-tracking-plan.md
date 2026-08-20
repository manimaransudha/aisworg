# Event Taxonomy & Tracking Plan

**Phase**: 13 - Growth & Optimization (aka: Product-Led Growth, Growth Loops, Experimentation Framework, 1→N Stage)  
**Deliverable Type**: Data Tracking Specification  
**Template Purpose**: Define standardized event structure and tracking implementation for consistent analytics  
**Last Updated**: November 2025

## Executive Summary

*This document establishes the event taxonomy and tracking plan that ensures consistent, accurate data collection across all product touchpoints for growth optimization.*

This tracking plan defines the standardized event structure, naming conventions, and implementation guidelines for NoteShare Pro's analytics infrastructure. It ensures consistent data collection across web, mobile, and API touchpoints to support growth measurement and optimization efforts.

## Event Taxonomy Structure

*Define the standardized format and naming conventions for all tracked events to ensure consistency across teams and platforms.*

### Event Naming Convention
```
[object]_[action]_[context]
```

**Examples:**
- `note_created_web`
- `user_invited_team`
- `subscription_upgraded_billing`
- `feature_discovered_onboarding`

### Event Categories

#### User Lifecycle Events
- **Authentication**: `user_signed_up`, `user_logged_in`, `user_logged_out`
- **Onboarding**: `onboarding_started`, `profile_completed`, `team_joined`
- **Activation**: `first_note_created`, `first_collaboration_initiated`

#### Core Product Events
- **Content Creation**: `note_created`, `note_edited`, `note_deleted`
- **Collaboration**: `note_shared`, `comment_added`, `user_mentioned`
- **Organization**: `folder_created`, `tag_applied`, `search_performed`

#### Engagement Events
- **Session**: `session_started`, `session_ended`, `page_viewed`
- **Feature Usage**: `feature_clicked`, `feature_completed`, `help_accessed`
- **Navigation**: `menu_opened`, `shortcut_used`, `search_initiated`

#### Business Events
- **Subscription**: `trial_started`, `plan_upgraded`, `payment_completed`
- **Team Management**: `user_invited`, `role_assigned`, `team_settings_changed`
- **Support**: `support_ticket_created`, `help_article_viewed`

## Event Properties Schema

*Standardize the data structure for event properties to ensure consistent analysis capabilities.*

### Standard Properties (All Events)
```json
{
  "event": "note_created",
  "timestamp": "2025-11-06T10:30:00.000Z",
  "user_id": "user_12345",
  "session_id": "session_abc123",
  "organization_id": "org_789",
  "properties": {
    // Event-specific properties
  },
  "context": {
    // Environmental context
  }
}
```

### User Context Properties
```json
{
  "user_id": "user_12345",
  "email": "john.doe@company.com",
  "role": "product_manager",
  "department": "product",
  "company_size": "mid_market",
  "signup_date": "2025-10-15",
  "plan_type": "professional",
  "trial_status": "converted",
  "last_active": "2025-11-06T09:15:00.000Z"
}
```

### Session Context Properties
```json
{
  "session_id": "session_abc123",
  "device_type": "desktop",
  "browser": "chrome",
  "browser_version": "119.0",
  "os": "macos",
  "screen_resolution": "1920x1080",
  "referrer": "google.com",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "note_sharing_q4"
}
```

## Core Event Definitions

*Define the most important events for growth measurement with their specific properties and triggers.*

### User Acquisition Events

#### user_signed_up
**Trigger**: User completes registration form
```json
{
  "event": "user_signed_up",
  "properties": {
    "signup_method": "email|google|sso",
    "referral_code": "string|null",
    "company_name": "string",
    "company_size": "startup|smb|mid_market|enterprise",
    "use_case": "meeting_notes|documentation|knowledge_base",
    "trial_length": 14
  }
}
```

#### trial_started
**Trigger**: User begins trial period
```json
{
  "event": "trial_started",
  "properties": {
    "trial_type": "free_trial|freemium",
    "trial_duration_days": 14,
    "plan_intended": "starter|professional|enterprise",
    "onboarding_completed": true|false
  }
}
```

### Activation Events

#### first_note_created
**Trigger**: User creates their first note
```json
{
  "event": "first_note_created",
  "properties": {
    "time_to_first_note_hours": 2.5,
    "note_type": "blank|template",
    "template_used": "string|null",
    "word_count": 150,
    "creation_method": "web|mobile|api"
  }
}
```

#### team_collaboration_started
**Trigger**: User first shares or collaborates on content
```json
{
  "event": "team_collaboration_started",
  "properties": {
    "collaboration_type": "share|comment|mention",
    "recipients_count": 3,
    "time_to_collaboration_hours": 24.5,
    "content_type": "note|folder"
  }
}
```

### Engagement Events

#### note_created
**Trigger**: User creates any note
```json
{
  "event": "note_created",
  "properties": {
    "note_id": "note_xyz789",
    "note_type": "meeting|project|personal|template",
    "template_used": "string|null",
    "word_count": 247,
    "has_attachments": true|false,
    "is_collaborative": true|false,
    "folder_id": "folder_123|null",
    "tags": ["meeting", "q4-planning"]
  }
}
```

#### feature_discovered
**Trigger**: User first uses a key feature
```json
{
  "event": "feature_discovered",
  "properties": {
    "feature_name": "real_time_collaboration|advanced_search|templates",
    "discovery_method": "onboarding|exploration|help",
    "time_to_discovery_hours": 12.3,
    "feature_completed": true|false
  }
}
```

### Retention Events

#### session_started
**Trigger**: User begins a new session
```json
{
  "event": "session_started",
  "properties": {
    "session_number": 15,
    "days_since_last_session": 2,
    "entry_point": "direct|bookmark|email|notification",
    "previous_session_duration_minutes": 45
  }
}
```

#### weekly_active_user
**Trigger**: User performs any action (calculated event)
```json
{
  "event": "weekly_active_user",
  "properties": {
    "week_number": 42,
    "actions_this_week": 23,
    "notes_created_this_week": 5,
    "collaborations_this_week": 8,
    "engagement_score": 85
  }
}
```

### Revenue Events

#### subscription_upgraded
**Trigger**: User upgrades their subscription plan
```json
{
  "event": "subscription_upgraded",
  "properties": {
    "from_plan": "starter",
    "to_plan": "professional",
    "upgrade_trigger": "seat_limit|feature_limit|usage_limit",
    "mrr_change": 50.00,
    "seats_added": 5,
    "upgrade_method": "self_serve|sales_assisted"
  }
}
```

## Implementation Guidelines

*Provide technical guidance for consistent event tracking implementation across platforms.*

### Web Application Tracking
```javascript
// Example implementation using analytics library
analytics.track('note_created', {
  note_id: noteId,
  note_type: noteType,
  template_used: templateId || null,
  word_count: getWordCount(content),
  has_attachments: attachments.length > 0,
  is_collaborative: isShared,
  folder_id: folderId || null,
  tags: selectedTags
}, {
  context: {
    page: window.location.pathname,
    referrer: document.referrer,
    user_agent: navigator.userAgent
  }
});
```

### Mobile Application Tracking
```swift
// iOS example
Analytics.track("note_created", properties: [
  "note_id": noteId,
  "note_type": noteType,
  "creation_method": "mobile",
  "word_count": wordCount,
  "has_attachments": hasAttachments
])
```

### Server-Side Tracking
```python
# Python example for backend events
analytics.track(
    user_id=user.id,
    event='subscription_upgraded',
    properties={
        'from_plan': old_plan.name,
        'to_plan': new_plan.name,
        'mrr_change': new_plan.price - old_plan.price,
        'upgrade_method': 'self_serve'
    }
)
```

## Data Quality Standards

*Establish requirements for data accuracy, completeness, and validation.*

### Validation Rules
- **Required Fields**: All events must include user_id, timestamp, and event name
- **Data Types**: Enforce proper data types for all properties
- **Value Constraints**: Validate enum values and numeric ranges
- **PII Handling**: Never track sensitive personal information in event properties

### Quality Monitoring
- **Missing Data Alerts**: Monitor for events with missing required properties
- **Anomaly Detection**: Alert on unusual spikes or drops in event volume
- **Schema Validation**: Automatically validate events against defined schema
- **Duplicate Detection**: Identify and handle duplicate event submissions

### Testing Requirements
- **Event Verification**: Test all event triggers in staging environment
- **Property Validation**: Verify all properties are captured correctly
- **Cross-Platform Consistency**: Ensure events fire consistently across platforms
- **Performance Impact**: Monitor tracking code performance impact

## Privacy and Compliance

*Ensure event tracking complies with privacy regulations and user expectations.*

### Privacy Considerations
- **User Consent**: Respect user privacy preferences and consent settings
- **Data Minimization**: Only track data necessary for business objectives
- **Anonymization**: Remove or hash PII where possible
- **Retention Policies**: Implement data retention and deletion policies

### GDPR Compliance
- **Lawful Basis**: Ensure legitimate interest or consent for all tracking
- **Data Subject Rights**: Support data portability and deletion requests
- **Privacy by Design**: Build privacy considerations into tracking implementation
- **Documentation**: Maintain records of data processing activities

## Maintenance and Evolution

*Establish processes for maintaining and updating the event taxonomy over time.*

### Change Management
- **Version Control**: Track changes to event definitions and properties
- **Deprecation Process**: Safely retire old events while maintaining historical data
- **Team Communication**: Notify relevant teams of taxonomy changes
- **Documentation Updates**: Keep tracking plan documentation current

### Regular Reviews
- **Quarterly Audits**: Review event usage and identify gaps or redundancies
- **Schema Evolution**: Update event properties based on new business needs
- **Performance Optimization**: Optimize tracking implementation for performance
- **Compliance Updates**: Ensure ongoing compliance with privacy regulations

---

*This event taxonomy should be treated as a living document, updated regularly as the product evolves and new growth optimization needs emerge. All teams implementing tracking should follow these standards to ensure data consistency and quality.*
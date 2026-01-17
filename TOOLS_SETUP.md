# Tool Use Implementation Guide

## Overview

The FocusForge AI agent now supports tool use for calendar and email access, making it a more capable agent that can:
- Check user's calendar for upcoming events
- Suggest meeting times based on availability
- Access recent emails for context
- Draft emails based on session activity

## Architecture

### Tool System Components

1. **Tool Registry** (`tools/tool_registry.py`)
   - Manages available tools
   - Converts tools to Gemini function calling format
   - Handles tool execution

2. **Calendar Tool** (`tools/calendar_tool.py`)
   - `get_upcoming_events`: Get upcoming calendar events
   - `check_availability`: Check if user is available
   - `suggest_meeting_times`: Suggest available meeting slots

3. **Email Tool** (`tools/email_tool.py`)
   - `get_recent_emails`: Get recent emails from inbox
   - `draft_email`: Create draft emails (safe, requires user review)

4. **Enhanced Analyzer** (`gemini_analyzer_with_tools.py`)
   - Integrates tools with Gemini function calling
   - Handles multi-step tool execution
   - Falls back gracefully if tools unavailable

## Setup

### 1. Install Dependencies

```bash
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

Add to `requirements.txt`:
```
google-api-python-client>=2.0.0
google-auth-httplib2>=0.1.0
google-auth-oauthlib>=0.5.0
```

### 2. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google Calendar API"
4. Create OAuth 2.0 credentials
5. Download credentials JSON

Set environment variable:
```bash
export GOOGLE_CALENDAR_CREDENTIALS=/path/to/credentials.json
```

Or set token directly:
```bash
export GOOGLE_CALENDAR_TOKEN='{"token": "...", "refresh_token": "..."}'
```

### 3. Gmail API Setup

1. In Google Cloud Console, enable "Gmail API"
2. Create OAuth 2.0 credentials with Gmail scope
3. Download credentials

Set environment variable:
```bash
export GMAIL_API_TOKEN='{"token": "...", "refresh_token": "..."}'
```

### 4. SMTP Setup (Alternative to Gmail API)

For basic email sending without Gmail API:

```bash
export SMTP_SERVER=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
```

## Usage

### Basic Usage

```python
from gemini_analyzer_with_tools import analyzeSessionWithGeminiAndTools

events = {
    "goal": "Prepare for interview",
    "events": [
        {"ts": 1730000000000, "url": "https://leetcode.com", "title": "Practice", "durationSec": 300}
    ]
}

# With tools enabled
result = analyzeSessionWithGeminiAndTools(
    goal="",
    eventsWithDuration=events,
    use_gemini=True,
    use_tools=True  # Enable tool use
)
```

### Tool Execution Flow

1. **Agent receives session data**
2. **Agent decides if tools are needed** (e.g., "user was scheduling meetings" → check calendar)
3. **Agent calls tools** via Gemini function calling
4. **Tools execute** and return results
5. **Agent incorporates tool results** into analysis
6. **Agent returns enhanced summary** with calendar/email context

### Example Tool Use Scenarios

**Scenario 1: Calendar Context**
```
User activity: Visiting meeting scheduling sites
Agent action: Calls get_upcoming_events()
Result: "You have 3 meetings today. Your session focused on preparing for the 2pm interview."
```

**Scenario 2: Email Context**
```
User activity: Job application sites
Agent action: Calls get_recent_emails(query="job application")
Result: "You received 2 emails about job applications today. Continue reviewing applications."
```

**Scenario 3: Meeting Suggestions**
```
User activity: Calendar/scheduling sites
Agent action: Calls suggest_meeting_times(duration_minutes=30)
Result: "Available times: Tomorrow 2pm, 3pm, or 4pm"
```

## Security & Privacy

### Current Implementation
- **Draft emails only**: Never sends emails directly (requires user review)
- **Read-only by default**: Calendar/email tools are read-only
- **OAuth required**: All API access requires proper authentication
- **Graceful degradation**: Works without tools if not configured

### Best Practices
1. **Store credentials securely**: Use environment variables, not code
2. **Minimal permissions**: Request only needed scopes
3. **User confirmation**: Always confirm before sending emails
4. **Error handling**: Tools fail gracefully without breaking analysis

## Tool Functions

### Calendar Tools

#### `get_upcoming_events(max_results: int = 10)`
Returns upcoming calendar events.

**Example:**
```python
{
    "events": [
        {
            "id": "event123",
            "summary": "Team Meeting",
            "start": "2024-01-15T14:00:00Z",
            "end": "2024-01-15T15:00:00Z",
            "location": "Conference Room A"
        }
    ],
    "count": 1
}
```

#### `check_availability(start_time: str, end_time: str)`
Checks if user is available during a time period.

**Example:**
```python
{
    "available": true,
    "start_time": "2024-01-15T14:00:00",
    "end_time": "2024-01-15T15:00:00"
}
```

#### `suggest_meeting_times(duration_minutes: int = 30, days_ahead: int = 7)`
Suggests available meeting times.

**Example:**
```python
{
    "suggestions": [
        {
            "start": "2024-01-16T09:00:00",
            "end": "2024-01-16T09:30:00",
            "available": true
        }
    ],
    "count": 10
}
```

### Email Tools

#### `get_recent_emails(max_results: int = 10, query: Optional[str] = None)`
Gets recent emails from inbox.

**Example:**
```python
{
    "emails": [
        {
            "id": "msg123",
            "from": "recruiter@company.com",
            "subject": "Interview Schedule",
            "date": "Mon, 15 Jan 2024 10:00:00",
            "snippet": "We'd like to schedule..."
        }
    ],
    "count": 5
}
```

#### `draft_email(to: str, subject: str, body: str)`
Creates a draft email (doesn't send).

**Example:**
```python
{
    "draft": {
        "to": "colleague@example.com",
        "subject": "Follow-up on project",
        "body": "Hi, I wanted to follow up..."
    },
    "note": "This is a draft. User can review before sending."
}
```

## Integration with Backend

To use tools in the backend API:

1. Update `backend/scripts/analyze.py` to use `gemini_analyzer_with_tools`
2. Set environment variables in backend deployment
3. Update `backend/pages/api/analyze.ts` if needed

## Testing

```python
# Test without tools
python gemini_analyzer_with_tools.py

# Test with tools (requires credentials)
export GOOGLE_CALENDAR_TOKEN='...'
export GMAIL_API_TOKEN='...'
python gemini_analyzer_with_tools.py
```

## Limitations & Future Enhancements

### Current Limitations
- Requires OAuth setup (not automatic)
- Tools are optional (graceful degradation)
- Email sending requires explicit user action
- No persistent tool state between sessions

### Future Enhancements
- Automatic OAuth flow in UI
- More tools (Slack, Notion, etc.)
- Tool result caching
- User preferences for tool use
- Proactive tool suggestions

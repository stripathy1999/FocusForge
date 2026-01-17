# Tool Use Implementation Summary

## What Was Implemented

A complete tool system for the FocusForge AI agent that enables calendar and email access.

## Architecture

### 1. Tool Registry System (`tools/tool_registry.py`)
- **Tool class**: Represents a callable tool with name, description, parameters, and handler
- **ToolRegistry**: Manages available tools and converts them to Gemini function calling format
- Supports dynamic tool registration and execution

### 2. Calendar Tools (`tools/calendar_tool.py`)
Three tools for calendar access:

- **`get_upcoming_events`**: Retrieves upcoming calendar events
  - Parameters: `max_results` (optional, default: 10)
  - Returns: List of events with details (summary, start, end, location)

- **`check_availability`**: Checks if user is available during a time period
  - Parameters: `start_time`, `end_time` (ISO format)
  - Returns: Availability status

- **`suggest_meeting_times`**: Suggests available meeting times
  - Parameters: `duration_minutes` (default: 30), `days_ahead` (default: 7)
  - Returns: List of suggested time slots

**Features:**
- Google Calendar API integration
- Graceful fallback if API not available
- OAuth authentication support
- Handles time zones and date parsing

### 3. Email Tools (`tools/email_tool.py`)
Two tools for email access:

- **`get_recent_emails`**: Gets recent emails from inbox
  - Parameters: `max_results` (default: 10), `query` (optional Gmail search)
  - Returns: List of emails with metadata

- **`draft_email`**: Creates draft emails (safe, requires user review)
  - Parameters: `to`, `subject`, `body`
  - Returns: Draft information (doesn't send)

**Features:**
- Gmail API integration
- SMTP fallback option
- Safe draft-only mode (never auto-sends)
- Email search query support

### 4. Enhanced Analyzer (`gemini_analyzer_with_tools.py`)
- Integrates tools with Gemini function calling
- Handles multi-step tool execution (up to 3 iterations)
- Falls back gracefully if tools unavailable
- Maintains conversation context for tool calls

## How It Works

### Tool Execution Flow

```
1. Agent receives session data
   ↓
2. Agent analyzes if tools would help
   (e.g., "user visited calendar sites" → check calendar)
   ↓
3. Agent calls tools via Gemini function calling
   ↓
4. Tools execute and return results
   ↓
5. Agent incorporates tool results into analysis
   ↓
6. Agent returns enhanced summary with context
```

### Example Use Cases

**Use Case 1: Calendar Context**
```
Input: User visited meeting scheduling sites
Agent: Calls get_upcoming_events()
Result: "You have 3 meetings today. Your session focused on preparing for the 2pm interview."
```

**Use Case 2: Email Context**
```
Input: User visited job application sites
Agent: Calls get_recent_emails(query="job application")
Result: "You received 2 emails about job applications. Continue reviewing applications."
```

**Use Case 3: Meeting Suggestions**
```
Input: User visited calendar/scheduling sites
Agent: Calls suggest_meeting_times(duration_minutes=30)
Result: "Available times: Tomorrow 2pm, 3pm, or 4pm"
```

## Files Created

1. `tools/__init__.py` - Tool module initialization
2. `tools/tool_registry.py` - Tool registry and management
3. `tools/calendar_tool.py` - Calendar access tools
4. `tools/email_tool.py` - Email access tools
5. `gemini_analyzer_with_tools.py` - Enhanced analyzer with tool support
6. `test_tools.py` - Test suite for tools
7. `TOOLS_SETUP.md` - Setup and configuration guide
8. `TOOLS_IMPLEMENTATION.md` - This file

## Dependencies Added

```txt
google-api-python-client>=2.0.0
google-auth-httplib2>=0.1.0
google-auth-oauthlib>=0.5.0
```

## Security Features

1. **Draft-only emails**: Never sends emails directly, always creates drafts
2. **Read-only by default**: Calendar/email tools are primarily read-only
3. **OAuth required**: All API access requires proper authentication
4. **Graceful degradation**: Works without tools if not configured
5. **Error handling**: Tools fail gracefully without breaking analysis

## Usage

### Basic Usage (Without Tools)
```python
from gemini_analyzer_with_tools import analyzeSessionWithGeminiAndTools

result = analyzeSessionWithGeminiAndTools(
    goal="",
    eventsWithDuration=events,
    use_tools=False  # Disable tools
)
```

### With Tools Enabled
```python
result = analyzeSessionWithGeminiAndTools(
    goal="",
    eventsWithDuration=events,
    use_tools=True  # Enable tools
)
```

### Manual Tool Execution
```python
from tools.tool_registry import ToolRegistry
from tools.calendar_tool import create_calendar_tools
from tools.email_tool import create_email_tool

registry = ToolRegistry()
for tool in create_calendar_tools():
    registry.register(tool)

# Execute a tool
tool = registry.get_tool("get_upcoming_events")
result = tool.handler(max_results=5)
```

## Testing

Run the test suite:
```bash
python test_tools.py
```

Tests cover:
- Tool registry functionality
- Calendar tool creation and execution
- Email tool creation and execution
- Integration with analyzer

## Next Steps

1. **OAuth Flow**: Implement full OAuth flow in UI
2. **More Tools**: Add Slack, Notion, etc.
3. **Tool Caching**: Cache tool results for performance
4. **User Preferences**: Let users enable/disable specific tools
5. **Proactive Suggestions**: Suggest tool use based on patterns

## Notes

- Tools are **optional** - system works without them
- Tools **fail gracefully** - errors don't break analysis
- **Draft emails only** - never sends without user confirmation
- **Read-focused** - calendar/email tools are primarily for reading context
- **Secure by default** - requires explicit authentication

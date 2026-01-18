"""
Calendar tool for accessing and managing calendar events.
"""
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

# Try to import Google Calendar API
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import Flow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    CALENDAR_AVAILABLE = True
except ImportError:
    CALENDAR_AVAILABLE = False
    print("Warning: Google Calendar API not installed. Calendar features will be disabled.")


class CalendarTool:
    """Tool for accessing calendar information."""
    
    def __init__(self, credentials_path: Optional[str] = None):
        """
        Initialize calendar tool.
        
        Args:
            credentials_path: Path to OAuth credentials JSON file
        """
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CALENDAR_CREDENTIALS')
        self.service = None
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Google Calendar API."""
        if not CALENDAR_AVAILABLE:
            return
        
        # For now, use service account or OAuth token from env
        # In production, implement full OAuth flow
        token = os.getenv('GOOGLE_CALENDAR_TOKEN')
        if token:
            try:
                creds = Credentials.from_authorized_user_info(json.loads(token))
                self.service = build('calendar', 'v3', credentials=creds)
            except Exception as e:
                print(f"Warning: Calendar authentication failed: {e}")
    
    def get_upcoming_events(self, max_results: int = 10, time_min: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get upcoming calendar events.
        
        Args:
            max_results: Maximum number of events to return
            time_min: Minimum time for events (defaults to now)
        
        Returns:
            List of event dictionaries
        """
        if not self.service:
            return []
        
        try:
            if time_min is None:
                time_min = datetime.utcnow()
            
            time_min_str = time_min.isoformat() + 'Z'
            
            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=time_min_str,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            result = []
            for event in events:
                start = event.get('start', {}).get('dateTime', event.get('start', {}).get('date'))
                result.append({
                    'id': event.get('id'),
                    'summary': event.get('summary', 'No title'),
                    'start': start,
                    'end': event.get('end', {}).get('dateTime', event.get('end', {}).get('date')),
                    'location': event.get('location', ''),
                    'description': event.get('description', '')
                })
            
            return result
        except HttpError as e:
            print(f"Error fetching calendar events: {e}")
            return []
        except Exception as e:
            print(f"Unexpected error in get_upcoming_events: {e}")
            return []
    
    def check_availability(self, start_time: datetime, end_time: datetime) -> bool:
        """
        Check if user is available during a time period.
        
        Args:
            start_time: Start of time period
            end_time: End of time period
        
        Returns:
            True if available, False if busy
        """
        if not self.service:
            return True  # Assume available if calendar not connected
        
        try:
            # Get events in the time range
            events = self.get_upcoming_events(
                time_min=start_time,
                max_results=50
            )
            
            # Check for conflicts
            for event in events:
                event_start = datetime.fromisoformat(event['start'].replace('Z', '+00:00'))
                event_end = datetime.fromisoformat(event['end'].replace('Z', '+00:00'))
                
                # Check for overlap
                if (event_start < end_time and event_end > start_time):
                    return False
            
            return True
        except Exception as e:
            print(f"Error checking availability: {e}")
            return True  # Assume available on error
    
    def suggest_meeting_times(self, duration_minutes: int = 30, days_ahead: int = 7) -> List[Dict[str, Any]]:
        """
        Suggest available meeting times.
        
        Args:
            duration_minutes: Duration of meeting in minutes
            days_ahead: How many days ahead to look
        
        Returns:
            List of suggested time slots
        """
        if not self.service:
            # Return default suggestions if calendar not available
            suggestions = []
            now = datetime.now()
            for day in range(days_ahead):
                date = now + timedelta(days=day)
                # Suggest 9am, 2pm, 4pm
                for hour in [9, 14, 16]:
                    suggestions.append({
                        'start': date.replace(hour=hour, minute=0, second=0, microsecond=0).isoformat(),
                        'end': (date.replace(hour=hour, minute=0, second=0, microsecond=0) + 
                               timedelta(minutes=duration_minutes)).isoformat(),
                        'available': True
                    })
            return suggestions[:10]  # Return top 10
        
        try:
            suggestions = []
            now = datetime.now()
            
            for day in range(days_ahead):
                date = now + timedelta(days=day)
                # Check common meeting times
                for hour in [9, 10, 11, 14, 15, 16]:
                    start_time = date.replace(hour=hour, minute=0, second=0, microsecond=0)
                    end_time = start_time + timedelta(minutes=duration_minutes)
                    
                    if self.check_availability(start_time, end_time):
                        suggestions.append({
                            'start': start_time.isoformat(),
                            'end': end_time.isoformat(),
                            'available': True
                        })
                    
                    if len(suggestions) >= 10:
                        break
                
                if len(suggestions) >= 10:
                    break
            
            return suggestions
        except Exception as e:
            print(f"Error suggesting meeting times: {e}")
            return []


def create_calendar_tools() -> List['Tool']:
    """Create Tool instances for calendar access."""
    from .tool_registry import Tool
    
    calendar = CalendarTool()
    
    def get_upcoming_events_handler(max_results: int = 10) -> Dict[str, Any]:
        """Handler for get_upcoming_events tool."""
        events = calendar.get_upcoming_events(max_results=max_results)
        return {
            "events": events,
            "count": len(events)
        }
    
    def check_availability_handler(start_time: str, end_time: str) -> Dict[str, Any]:
        """Handler for check_availability tool."""
        start = datetime.fromisoformat(start_time)
        end = datetime.fromisoformat(end_time)
        available = calendar.check_availability(start, end)
        return {
            "available": available,
            "start_time": start_time,
            "end_time": end_time
        }
    
    def suggest_meeting_times_handler(duration_minutes: int = 30, days_ahead: int = 7) -> Dict[str, Any]:
        """Handler for suggest_meeting_times tool."""
        suggestions = calendar.suggest_meeting_times(duration_minutes, days_ahead)
        return {
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    
    # Create multiple calendar tools
    tools = []
    
    tools.append(Tool(
        name="get_upcoming_events",
        description="Get upcoming calendar events. Useful for understanding user's schedule and upcoming commitments.",
        parameters={
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of events to return (default: 10)"
                }
            },
            "required": []
        },
        handler=get_upcoming_events_handler
    ))
    
    tools.append(Tool(
        name="check_availability",
        description="Check if user is available during a specific time period. Use this before suggesting meeting times.",
        parameters={
            "properties": {
                "start_time": {
                    "type": "string",
                    "description": "Start time in ISO format (e.g., '2024-01-15T14:00:00')"
                },
                "end_time": {
                    "type": "string",
                    "description": "End time in ISO format (e.g., '2024-01-15T15:00:00')"
                }
            },
            "required": ["start_time", "end_time"]
        },
        handler=check_availability_handler
    ))
    
    tools.append(Tool(
        name="suggest_meeting_times",
        description="Suggest available meeting times for the user. Useful when user needs to schedule something based on their session activity.",
        parameters={
            "properties": {
                "duration_minutes": {
                    "type": "integer",
                    "description": "Duration of meeting in minutes (default: 30)"
                },
                "days_ahead": {
                    "type": "integer",
                    "description": "How many days ahead to look (default: 7)"
                }
            },
            "required": []
        },
        handler=suggest_meeting_times_handler
    ))
    
    return tools

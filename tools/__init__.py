"""
Tool system for FocusForge AI agent.
Provides calendar and email access capabilities.
"""

from .calendar_tool import CalendarTool, create_calendar_tools
from .email_tool import EmailTool, create_email_tool
from .tool_registry import ToolRegistry, Tool

__all__ = ['CalendarTool', 'EmailTool', 'ToolRegistry', 'Tool', 'create_calendar_tools', 'create_email_tool']

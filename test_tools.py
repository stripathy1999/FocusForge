#!/usr/bin/env python3
"""
Test script for tool use functionality.
"""
import json
import os
import sys

# Add current directory to path
sys.path.insert(0, '.')

def test_tool_registry():
    """Test tool registry functionality."""
    print("=" * 60)
    print("Testing Tool Registry")
    print("=" * 60)
    
    try:
        from tools.tool_registry import ToolRegistry, Tool
        
        registry = ToolRegistry()
        
        # Create a simple test tool
        def test_handler(message: str) -> dict:
            return {"echo": message}
        
        test_tool = Tool(
            name="test_tool",
            description="A test tool",
            parameters={
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "Message to echo"
                    }
                },
                "required": ["message"]
            },
            handler=test_handler
        )
        
        registry.register(test_tool)
        
        # Test getting tool
        tool = registry.get_tool("test_tool")
        assert tool is not None, "Tool should be found"
        print("✓ Tool registration works")
        
        # Test executing tool
        result = tool.handler(message="Hello, world!")
        assert result["echo"] == "Hello, world!", "Tool execution should work"
        print("✓ Tool execution works")
        
        # Test Gemini function format
        gemini_func = tool.to_gemini_function()
        assert gemini_func["name"] == "test_tool", "Gemini function format should be correct"
        print("✓ Gemini function format works")
        
        print("\n✅ Tool Registry tests passed!")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure tools module is available")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_calendar_tool():
    """Test calendar tool (without actual API connection)."""
    print("\n" + "=" * 60)
    print("Testing Calendar Tool")
    print("=" * 60)
    
    try:
        from tools.calendar_tool import CalendarTool, create_calendar_tools
        
        # Create calendar tool (will work without credentials, just return empty)
        calendar = CalendarTool()
        print("✓ CalendarTool initialized")
        
        # Test tools creation
        tools = create_calendar_tools()
        assert len(tools) == 3, "Should create 3 calendar tools"
        print(f"✓ Created {len(tools)} calendar tools")
        
        # Test tool names
        tool_names = [t.name for t in tools]
        assert "get_upcoming_events" in tool_names
        assert "check_availability" in tool_names
        assert "suggest_meeting_times" in tool_names
        print("✓ All calendar tools have correct names")
        
        # Test without credentials (should return empty/default)
        events = calendar.get_upcoming_events(max_results=5)
        print(f"✓ get_upcoming_events works (returned {len(events)} events)")
        
        print("\n✅ Calendar Tool tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_email_tool():
    """Test email tool (without actual API connection)."""
    print("\n" + "=" * 60)
    print("Testing Email Tool")
    print("=" * 60)
    
    try:
        from tools.email_tool import EmailTool, create_email_tool
        
        # Create email tool
        email = EmailTool()
        print("✓ EmailTool initialized")
        
        # Test tools creation
        tools = create_email_tool()
        assert len(tools) >= 2, "Should create at least 2 email tools"
        print(f"✓ Created {len(tools)} email tools")
        
        # Test tool names
        tool_names = [t.name for t in tools]
        assert "get_recent_emails" in tool_names
        assert "draft_email" in tool_names
        print("✓ All email tools have correct names")
        
        # Test draft email (doesn't require API)
        draft = email.draft_email(
            to="test@example.com",
            subject="Test",
            body="Test body"
        )
        assert "draft" in draft, "Draft should be created"
        print("✓ draft_email works")
        
        print("\n✅ Email Tool tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_integration():
    """Test integration with analyzer."""
    print("\n" + "=" * 60)
    print("Testing Integration")
    print("=" * 60)
    
    try:
        from gemini_analyzer_with_tools import analyzeSessionWithGeminiAndTools
        
        test_input = {
            "goal": "Test with tools",
            "events": [
                {"ts": 1730000000000, "url": "https://calendar.google.com", "title": "Calendar", "durationSec": 60}
            ]
        }
        
        # Test without tools (should work)
        result = analyzeSessionWithGeminiAndTools(
            goal="",
            eventsWithDuration=test_input,
            use_gemini=False,  # Use basic analyzer
            use_tools=False
        )
        
        assert "goalInferred" in result, "Should return valid result"
        print("✓ Integration works without tools")
        
        print("\n✅ Integration tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("FocusForge Tool System Tests\n")
    
    results = []
    results.append(test_tool_registry())
    results.append(test_calendar_tool())
    results.append(test_email_tool())
    results.append(test_integration())
    
    print("\n" + "=" * 60)
    if all(results):
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 60)

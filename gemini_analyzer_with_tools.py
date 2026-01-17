"""
Enhanced analyzer with Gemini AI integration and tool use (calendar, email).
"""
import json
import os
from typing import Dict, List, Any, Optional
from analyzer import analyzeSession, group_events_by_domain, create_workspaces_from_domains, get_last_stop

# Import tools
try:
    from tools.tool_registry import ToolRegistry
    from tools.calendar_tool import create_calendar_tools
    from tools.email_tool import create_email_tool
    TOOLS_AVAILABLE = True
except ImportError:
    TOOLS_AVAILABLE = False
    print("Warning: Tools not available. Install required dependencies.")

# Try to import Gemini (will fail gracefully if not installed)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Gemini features will be disabled.")


GEMINI_PROMPT = """You are FocusForge, an AI agent that analyzes browser activity from a single focus session. You have access to tools for calendar and email to provide better context and suggestions.

CRITICAL: resumeSummary Guidelines
- Write in natural, conversational language (1-2 sentences)
- Group activities by INTENTION/PURPOSE, not by individual websites
- Use SERVICE NAMES (e.g., "Canva", "Netflix", "Google Docs", "GitHub") - NEVER use full URLs or domains
- Describe WHAT the user was doing, not WHERE they were browsing
- Use action verbs: designing, researching, applying, coding, learning, etc.

TOOL USE GUIDELINES:
- Use get_upcoming_events to check user's calendar when suggesting meeting times or understanding schedule conflicts
- Use get_recent_emails to check for relevant emails related to the session activity
- Use suggest_meeting_times when user's activity suggests they need to schedule something
- Use draft_email when user's activity suggests they need to send an email (always draft first, never send directly)
- Only use tools when they add value to the analysis - don't call tools unnecessarily

Examples of GOOD summaries:
✓ "You were switching between designing on Canva and applying for jobs on Netflix"
✓ "You spent time researching on Wikipedia and coding on GitHub"
✓ "You were working on job applications, switching between LinkedIn and company career pages"

Other constraints: limit workspaces to max 5. nextActions max 5 and each starts with a verb. pendingDecisions max 3. Do not invent websites, events, or facts not in the input. lastStop.url must be present in the input events. Labels should be short and human-friendly.

Return ONLY valid JSON that matches the schema below. No backticks. No explanations.

Schema:
{ "goalInferred":"string", "workspaces":[{"label":"string","timeSec":0,"topUrls":["string"]}], "resumeSummary":"string", "lastStop":{"label":"string","url":"string"}, "nextActions":["string"], "pendingDecisions":["string"] }"""


def extract_service_name(url: str) -> str:
    """Extract a human-readable service name from URL."""
    from urllib.parse import urlparse
    import re
    
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        
        # Remove www. prefix
        domain = re.sub(r'^www\.', '', domain, flags=re.IGNORECASE)
        
        # Split by dots and get the main domain part (usually second-to-last)
        parts = domain.split('.')
        if len(parts) >= 2:
            main_part = parts[-2] if len(parts) > 2 else parts[0]
        else:
            main_part = parts[0] if parts else "unknown"
        
        # Capitalize first letter
        return main_part.capitalize() if main_part else "Unknown"
    except Exception:
        return "Unknown"


def create_gemini_input(goal: str, events: List[Dict], workspaces: List[Dict], last_stop: Dict) -> str:
    """Create input string for Gemini analysis with enhanced context."""
    from analyzer import extract_domain
    
    events_summary = []
    for event in events:
        url = event.get("url", "")
        domain = extract_domain(url)
        service_name = extract_service_name(url)
        
        events_summary.append({
            "url": url,
            "title": event.get("title", ""),
            "durationSec": event.get("durationSec", 0),
            "domain": domain,
            "service": service_name
        })
    
    # Enhance workspaces with service names
    enhanced_workspaces = []
    for ws in workspaces:
        enhanced_ws = ws.copy()
        service_names = [extract_service_name(url) for url in ws.get("topUrls", [])]
        enhanced_ws["services"] = list(set(service_names))
        enhanced_workspaces.append(enhanced_ws)
    
    input_data = {
        "goal": goal,
        "events": events_summary,
        "workspaces": enhanced_workspaces,
        "lastStop": last_stop
    }
    
    return json.dumps(input_data, indent=2)


def clean_json_response(response_text: str) -> str:
    """Extract JSON from response, removing markdown code blocks if present."""
    response_text = response_text.strip()
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    elif response_text.startswith("```"):
        response_text = response_text[3:]
    
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    
    return response_text.strip()


def execute_tool_call(tool_name: str, arguments: Dict[str, Any], tool_registry: ToolRegistry) -> Dict[str, Any]:
    """Execute a tool call and return the result."""
    tool = tool_registry.get_tool(tool_name)
    if not tool:
        return {"error": f"Tool '{tool_name}' not found"}
    
    try:
        result = tool.handler(**arguments)
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}


def call_gemini_with_tools(
    goal: str, 
    events: List[Dict], 
    workspaces: List[Dict], 
    last_stop: Dict, 
    tool_registry: Optional[ToolRegistry] = None,
    api_key: Optional[str] = None, 
    max_tool_iterations: int = 3
) -> Dict[str, Any]:
    """
    Call Gemini API with tool support.
    
    Args:
        goal: User's goal
        events: List of events
        workspaces: Pre-computed workspaces
        last_stop: Last stop info
        tool_registry: Registry of available tools
        api_key: Gemini API key
        max_tool_iterations: Maximum number of tool call iterations
    
    Returns:
        Parsed JSON response
    """
    if not GEMINI_AVAILABLE:
        raise ImportError("google-generativeai is not installed.")
    
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key not provided.")
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    model_name = 'gemini-2.0-flash-exp'  # Use model that supports function calling
    try:
        model = genai.GenerativeModel(model_name)
    except Exception:
        # Fallback
        model = genai.GenerativeModel('gemini-1.5-pro')
    
    # Prepare tools for Gemini
    tools_config = None
    if tool_registry and TOOLS_AVAILABLE:
        functions = tool_registry.get_gemini_functions()
        if functions:
            tools_config = genai.protos.Tool(
                function_declarations=[genai.protos.FunctionDeclaration(**f) for f in functions]
            )
    
    # Create input
    gemini_input = create_gemini_input(goal, events, workspaces, last_stop)
    full_prompt = f"{GEMINI_PROMPT}\n\nInput:\n{gemini_input}"
    
    # Conversation history for tool calls
    conversation = [{"role": "user", "parts": [full_prompt]}]
    
    # Iterate for tool calls
    for iteration in range(max_tool_iterations):
        try:
            # Call Gemini
            if tools_config:
                response = model.generate_content(
                    conversation,
                    tools=[tools_config],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.3,
                        top_p=0.95,
                        top_k=40,
                    )
                )
            else:
                response = model.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.3,
                        top_p=0.95,
                        top_k=40,
                    )
                )
            
            # Check for function calls
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                
                # Check if there are function calls
                if hasattr(candidate, 'content') and candidate.content:
                    parts = candidate.content.parts
                    
                    # Look for function calls
                    function_calls = [p for p in parts if hasattr(p, 'function_call')]
                    
                    if function_calls:
                        # Execute tool calls
                        tool_results = []
                        for func_call in function_calls:
                            tool_name = func_call.function_call.name
                            arguments = json.loads(func_call.function_call.args)
                            
                            result = execute_tool_call(tool_name, arguments, tool_registry)
                            tool_results.append({
                                "function_response": {
                                    "name": tool_name,
                                    "response": result
                                }
                            })
                        
                        # Add tool results to conversation
                        conversation.append({
                            "role": "model",
                            "parts": parts
                        })
                        conversation.append({
                            "role": "user",
                            "parts": [genai.protos.Part(function_response=r["function_response"]) for r in tool_results]
                        })
                        
                        # Continue iteration
                        continue
            
            # No function calls, get final response
            if hasattr(response, 'text') and response.text:
                response_text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                # Extract text from candidates
                text_parts = []
                for candidate in response.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if hasattr(part, 'text'):
                                text_parts.append(part.text)
                response_text = ' '.join(text_parts)
            else:
                raise ValueError("Gemini returned empty response")
            
            cleaned_response = clean_json_response(response_text)
            
            # Parse JSON
            try:
                result = json.loads(cleaned_response)
                return result
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse Gemini response as JSON: {e}\nResponse: {response_text}")
                
        except ValueError as e:
            raise
        except Exception as e:
            raise RuntimeError(f"Gemini API call failed: {e}")
    
    # If we've exhausted iterations, try to get final response
    raise RuntimeError("Maximum tool call iterations reached")


def analyzeSessionWithGeminiAndTools(
    goal: str, 
    eventsWithDuration: Dict, 
    api_key: Optional[str] = None, 
    use_gemini: bool = True,
    use_tools: bool = True
) -> Dict[str, Any]:
    """
    Enhanced analyzeSession with Gemini AI integration and tool use.
    
    Args:
        goal: User's goal string (can be empty)
        eventsWithDuration: Dict with "events" key containing list of event dicts
        api_key: Optional Gemini API key
        use_gemini: Whether to use Gemini (False falls back to basic analysis)
        use_tools: Whether to enable tool use
    
    Returns:
        Dict matching the required schema
    """
    events = eventsWithDuration.get("events", [])
    
    if not events:
        return analyzeSession(goal, eventsWithDuration)
    
    # Step 1: Do basic domain grouping first
    domain_data = group_events_by_domain(events)
    workspaces = create_workspaces_from_domains(domain_data, max_workspaces=5)
    last_stop = get_last_stop(events)
    
    # Step 2: Enhance with Gemini if available
    if use_gemini and GEMINI_AVAILABLE:
        try:
            # Set up tool registry if tools are enabled
            tool_registry = None
            if use_tools and TOOLS_AVAILABLE:
                tool_registry = ToolRegistry()
                # Register calendar tools
                for tool in create_calendar_tools():
                    tool_registry.register(tool)
                # Register email tools
                for tool in create_email_tool():
                    tool_registry.register(tool)
            
            gemini_result = call_gemini_with_tools(
                goal, events, workspaces, last_stop, 
                tool_registry=tool_registry,
                api_key=api_key
            )
            
            # Validate the result (import from original file)
            from gemini_analyzer import validate_output
            validate_output(gemini_result, events)
            
            return gemini_result
        except Exception as e:
            print(f"Warning: Gemini analysis with tools failed ({e}), falling back to basic analysis")
            # Fall through to basic analysis
    
    # Fallback to basic analysis
    return analyzeSession(goal, eventsWithDuration)


if __name__ == "__main__":
    # Test with example data
    test_input = {
        "goal": "Prepare for technical interview",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum - LeetCode", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://docs.google.com/document/d/123", "title": "Resume Draft", "durationSec": 240}
        ]
    }
    
    print("=== With Gemini and Tools ===")
    try:
        result = analyzeSessionWithGeminiAndTools(
            test_input["goal"], 
            test_input, 
            use_gemini=True,
            use_tools=True
        )
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Analysis not available: {e}")

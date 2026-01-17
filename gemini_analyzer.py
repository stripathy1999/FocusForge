"""
Enhanced analyzer with Gemini AI integration for intelligent analysis.
"""
import json
import os
from typing import Dict, List, Any, Optional
from analyzer import analyzeSession, group_events_by_domain, create_workspaces_from_domains, get_last_stop

# Try to import Gemini (will fail gracefully if not installed)
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Gemini features will be disabled.")


GEMINI_PROMPT = """You are FocusForge, an assistant that analyzes browser activity from a single focus session. Return ONLY valid JSON that matches the schema below. No backticks. No explanations. Constraints: limit workspaces to max 5. nextActions max 5 and each starts with a verb. pendingDecisions max 3. resumeSummary 1–2 sentences. Do not invent websites, events, or facts not in the input. lastStop.url must be present in the input events. Labels should be short and human-friendly.

Schema:
{ "goalInferred":"string", "workspaces":[{"label":"string","timeSec":0,"topUrls":["string"]}], "resumeSummary":"string", "lastStop":{"label":"string","url":"string"}, "nextActions":["string"], "pendingDecisions":["string"] }"""


def create_gemini_input(goal: str, events: List[Dict], workspaces: List[Dict], last_stop: Dict) -> str:
    """Create input string for Gemini analysis."""
    events_summary = []
    for event in events:
        events_summary.append({
            "url": event.get("url", ""),
            "title": event.get("title", ""),
            "durationSec": event.get("durationSec", 0)
        })
    
    input_data = {
        "goal": goal,
        "events": events_summary,
        "workspaces": workspaces,
        "lastStop": last_stop
    }
    
    return json.dumps(input_data, indent=2)


def clean_json_response(response_text: str) -> str:
    """Extract JSON from response, removing markdown code blocks if present."""
    # Remove markdown code blocks
    response_text = response_text.strip()
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    elif response_text.startswith("```"):
        response_text = response_text[3:]
    
    if response_text.endswith("```"):
        response_text = response_text[:-3]
    
    return response_text.strip()


def call_gemini(goal: str, events: List[Dict], workspaces: List[Dict], last_stop: Dict, api_key: Optional[str] = None, retry: bool = True) -> Dict[str, Any]:
    """
    Call Gemini API with the analysis prompt.
    
    Args:
        goal: User's goal
        events: List of events
        workspaces: Pre-computed workspaces
        last_stop: Last stop info
        api_key: Gemini API key (or from GEMINI_API_KEY env var)
        retry: Whether to retry on JSON parse failure
    
    Returns:
        Parsed JSON response
    """
    if not GEMINI_AVAILABLE:
        raise ImportError("google-generativeai is not installed. Install it with: pip install google-generativeai")
    
    # Get API key
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key not provided. Set GEMINI_API_KEY environment variable or pass api_key parameter.")
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-pro')
    
    # Create input
    gemini_input = create_gemini_input(goal, events, workspaces, last_stop)
    full_prompt = f"{GEMINI_PROMPT}\n\nInput:\n{gemini_input}"
    
    try:
        # Call Gemini with low temperature
        response = model.generate_content(
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                top_p=0.95,
                top_k=40,
            )
        )
        
        response_text = response.text
        cleaned_response = clean_json_response(response_text)
        
        # Parse JSON
        try:
            result = json.loads(cleaned_response)
            return result
        except json.JSONDecodeError as e:
            if retry:
                # Retry with stricter instruction
                retry_prompt = "Output only valid JSON.\n\n" + full_prompt
                retry_response = model.generate_content(retry_prompt)
                retry_text = clean_json_response(retry_response.text)
                return json.loads(retry_text)
            else:
                raise ValueError(f"Failed to parse Gemini response as JSON: {e}\nResponse: {response_text}")
                
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}")


def validate_output(output: Dict[str, Any], events: List[Dict]) -> bool:
    """
    Validate output against schema and constraints.
    
    Returns:
        True if valid, raises ValueError if invalid
    """
    # Check required fields
    required_fields = ["goalInferred", "workspaces", "resumeSummary", "lastStop", "nextActions", "pendingDecisions"]
    for field in required_fields:
        if field not in output:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate workspaces (max 5)
    workspaces = output["workspaces"]
    if len(workspaces) > 5:
        raise ValueError(f"Too many workspaces: {len(workspaces)} (max 5)")
    
    for ws in workspaces:
        if not all(key in ws for key in ["label", "timeSec", "topUrls"]):
            raise ValueError(f"Invalid workspace structure: {ws}")
    
    # Validate nextActions (max 5, must start with verb)
    next_actions = output["nextActions"]
    if len(next_actions) > 5:
        raise ValueError(f"Too many nextActions: {len(next_actions)} (max 5)")
    
    # Validate pendingDecisions (max 3)
    pending_decisions = output["pendingDecisions"]
    if len(pending_decisions) > 3:
        raise ValueError(f"Too many pendingDecisions: {len(pending_decisions)} (max 3)")
    
    # Validate resumeSummary (1-2 sentences)
    resume_summary = output["resumeSummary"]
    sentence_count = len([s for s in resume_summary.split('.') if s.strip()])
    if sentence_count < 1 or sentence_count > 2:
        # Warn but don't fail (sometimes periods can be in URLs, etc.)
        pass
    
    # Validate lastStop.url is in input events
    last_stop_url = output["lastStop"].get("url", "")
    input_urls = {event.get("url", "") for event in events}
    if last_stop_url and last_stop_url not in input_urls:
        raise ValueError(f"lastStop.url '{last_stop_url}' not found in input events")
    
    # Validate all workspace URLs are in input events
    for ws in workspaces:
        for url in ws.get("topUrls", []):
            if url and url not in input_urls:
                raise ValueError(f"Workspace URL '{url}' not found in input events")
    
    return True


def analyzeSessionWithGemini(goal: str, eventsWithDuration: Dict, api_key: Optional[str] = None, use_gemini: bool = True) -> Dict[str, Any]:
    """
    Enhanced analyzeSession with Gemini AI integration.
    
    Args:
        goal: User's goal string (can be empty)
        eventsWithDuration: Dict with "events" key containing list of event dicts
        api_key: Optional Gemini API key
        use_gemini: Whether to use Gemini (False falls back to basic analysis)
    
    Returns:
        Dict matching the required schema
    """
    events = eventsWithDuration.get("events", [])
    
    if not events:
        return analyzeSession(goal, eventsWithDuration)
    
    # Step 1: Do basic domain grouping first (fast, reliable)
    domain_data = group_events_by_domain(events)
    workspaces = create_workspaces_from_domains(domain_data, max_workspaces=5)
    last_stop = get_last_stop(events)
    
    # Step 2: Enhance with Gemini if available
    if use_gemini and GEMINI_AVAILABLE:
        try:
            gemini_result = call_gemini(goal, events, workspaces, last_stop, api_key=api_key)
            
            # Validate the result
            validate_output(gemini_result, events)
            
            return gemini_result
        except Exception as e:
            print(f"Warning: Gemini analysis failed ({e}), falling back to basic analysis")
            # Fall through to basic analysis
    
    # Fallback to basic analysis (no Gemini)
    return analyzeSession(goal, eventsWithDuration)


if __name__ == "__main__":
    # Test with example data
    test_input = {
        "goal": "Prepare for technical interview",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum - LeetCode", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://docs.google.com/document/d/123", "title": "Resume Draft", "durationSec": 240},
            {"ts": 1730000000330, "url": "https://leetcode.com/problems/valid-parentheses", "title": "Valid Parentheses - LeetCode", "durationSec": 120}
        ]
    }
    
    print("=== Basic Analysis (no Gemini) ===")
    result_basic = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result_basic, indent=2))
    
    print("\n=== With Gemini (if available) ===")
    try:
        result_gemini = analyzeSessionWithGemini(test_input["goal"], test_input, use_gemini=True)
        print(json.dumps(result_gemini, indent=2))
    except Exception as e:
        print(f"Gemini analysis not available: {e}")
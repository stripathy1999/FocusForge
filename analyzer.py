"""
FocusForge session analyzer - transforms browser tracking events into structured JSON.
"""
import json
import re
from urllib.parse import urlparse
from typing import Dict, List, Optional, Any
from collections import defaultdict


def extract_domain(url: str) -> str:
    """Extract domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        # Remove www. prefix
        domain = re.sub(r'^www\.', '', domain, flags=re.IGNORECASE)
        return domain.lower()
    except Exception:
        return "unknown"


def group_events_by_domain(events: List[Dict]) -> Dict[str, Dict]:
    """
    Group events by domain and compute timeSec and top URLs.
    Returns a dict: {domain: {"timeSec": int, "urls": {url: timeSec}}}
    """
    domain_data = defaultdict(lambda: {"timeSec": 0, "urls": defaultdict(int)})
    
    for event in events:
        url = event.get("url", "")
        duration = event.get("durationSec", 0)
        domain = extract_domain(url)
        
        domain_data[domain]["timeSec"] += duration
        domain_data[domain]["urls"][url] += duration
    
    return domain_data


def get_top_urls(url_dict: Dict[str, int], max_urls: int = 5) -> List[str]:
    """Get top N URLs by total time spent."""
    sorted_urls = sorted(url_dict.items(), key=lambda x: x[1], reverse=True)
    return [url for url, _ in sorted_urls[:max_urls]]


def create_workspaces_from_domains(domain_data: Dict[str, Dict], max_workspaces: int = 5) -> List[Dict]:
    """
    Convert domain data into workspace objects.
    Labels are domain names (can be enhanced with Gemini later).
    """
    # Sort by total time (descending)
    sorted_domains = sorted(
        domain_data.items(),
        key=lambda x: x[1]["timeSec"],
        reverse=True
    )[:max_workspaces]
    
    workspaces = []
    for domain, data in sorted_domains:
        top_urls = get_top_urls(data["urls"], max_urls=5)
        workspaces.append({
            "label": domain,
            "timeSec": data["timeSec"],
            "topUrls": top_urls
        })
    
    return workspaces


def get_last_stop(events: List[Dict]) -> Dict[str, str]:
    """Get the last stop from events (last event by timestamp)."""
    if not events:
        return {"label": "Unknown", "url": ""}
    
    # Sort by timestamp (descending) and get the last one
    sorted_events = sorted(events, key=lambda x: x.get("ts", 0), reverse=True)
    last_event = sorted_events[0]
    
    url = last_event.get("url", "")
    title = last_event.get("title", "")
    domain = extract_domain(url)
    
    return {
        "label": title or domain or "Unknown",
        "url": url
    }


def analyzeSession(goal: str, eventsWithDuration: Dict) -> Dict[str, Any]:
    """
    Main function to analyze browser session and return structured JSON.
    
    Args:
        goal: User's goal string (can be empty)
        eventsWithDuration: Dict with "events" key containing list of event dicts
            Each event has: ts, url, title, durationSec
    
    Returns:
        Dict matching the required schema:
        {
            "goalInferred": "string",
            "workspaces": [{"label": "string", "timeSec": 0, "topUrls": ["string"]}],
            "resumeSummary": "string",
            "lastStop": {"label": "string", "url": "string"},
            "nextActions": ["string"],
            "pendingDecisions": ["string"]
        }
    """
    events = eventsWithDuration.get("events", [])
    
    if not events:
        return {
            "goalInferred": goal or "No activity detected",
            "workspaces": [],
            "resumeSummary": "No browser activity was recorded in this session.",
            "lastStop": {"label": "Unknown", "url": ""},
            "nextActions": [],
            "pendingDecisions": []
        }
    
    # Step 1: Group by domain
    domain_data = group_events_by_domain(events)
    
    # Step 2: Create workspaces (limit to 5)
    workspaces = create_workspaces_from_domains(domain_data, max_workspaces=5)
    
    # Step 3: Get last stop
    last_stop = get_last_stop(events)
    
    # Step 4: Prepare data for Gemini (if available)
    # For now, return basic structure without Gemini
    # This matches the milestone requirement: "grouping by domain + timeSec works locally"
    
    # Infer goal from activity if not provided
    goal_inferred = goal
    if not goal_inferred and workspaces:
        # Simple inference: use the top domain as a hint
        top_domain = workspaces[0]["label"] if workspaces else ""
        goal_inferred = f"Working on {top_domain}" if top_domain else "No specific goal identified"
    
    # Create basic summary
    total_time = sum(w["timeSec"] for w in workspaces)
    num_sites = len(workspaces)
    resume_summary = f"Spent {total_time} seconds across {num_sites} different sites."
    if workspaces:
        top_site = workspaces[0]["label"]
        resume_summary += f" Most time on {top_site}."
    
    # Basic next actions (enhanced by Gemini later)
    next_actions = []
    if workspaces:
        next_actions = [
            f"Continue work on {workspaces[0]['label']}",
            "Review progress and plan next steps"
        ]
    
    return {
        "goalInferred": goal_inferred,
        "workspaces": workspaces,
        "resumeSummary": resume_summary,
        "lastStop": last_stop,
        "nextActions": next_actions[:5],  # Max 5
        "pendingDecisions": []  # Will be filled by Gemini
    }


if __name__ == "__main__":
    # Test with example data
    test_input = {
        "goal": "",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum - LeetCode", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://docs.google.com/document/d/123", "title": "Resume Draft", "durationSec": 240}
        ]
    }
    
    result = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result, indent=2))
"""
Task Planning Agent - Takes analysis summaries and provides actionable suggestions.

This agent is separate from the analysis agent and focuses on:
- Task prioritization
- Ordering responsibilities
- Suggesting next actions
- Providing strategic guidance
"""
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

# Try to import Gemini
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-generativeai not installed. Planner agent will be disabled.")

# Import tools
try:
    from tools.tool_registry import ToolRegistry
    from tools.calendar_tool import create_calendar_tools
    from tools.email_tool import create_email_tool
    TOOLS_AVAILABLE = True
except ImportError:
    TOOLS_AVAILABLE = False


PLANNER_PROMPT = """You are FocusForge Task Planner, an AI agent that helps users prioritize tasks and plan their work based on session analysis.

Your role is to:
1. Analyze the session summary and identify key tasks/responsibilities
2. Prioritize tasks based on urgency, importance, and context
3. Order tasks in a logical sequence
4. Suggest new tasks that align with user goals
5. Provide strategic guidance on how to proceed

You have access to tools:
- Calendar: Check upcoming events, availability, suggest meeting times
- Email: Check recent emails for context, draft emails

Use tools when they help provide better suggestions. For example:
- If user has meetings coming up, check calendar to see what they're preparing for
- If user was working on applications, check emails for responses
- Suggest meeting times if user needs to schedule something

CRITICAL GUIDELINES:
- Prioritize tasks by urgency (deadlines, meetings) and importance (goals)
- Order tasks logically (prerequisites first, then dependent tasks)
- Suggest 3-7 tasks (not too many, not too few)
- Each task should be specific and actionable
- Consider user's goals and session activity
- Use calendar/email context when relevant
- Be strategic: suggest what will have the most impact

Output format (JSON only, no backticks):
{
  "prioritizedTasks": [
    {
      "id": "task_1",
      "title": "Specific actionable task",
      "priority": "high" | "medium" | "low",
      "urgency": "urgent" | "soon" | "later",
      "estimatedTime": "30 minutes" | "1 hour" | etc,
      "dependencies": ["task_2"],  // IDs of tasks that must be done first
      "description": "Clear, actionable description of what to do for this task",
      "reason": "Why this task is important",
      "context": "Additional context from calendar/email if available"
    }
  ],
  "taskOrder": ["task_1", "task_2", "task_3"],  // Recommended execution order
  "suggestions": [
    "Strategic suggestion 1",
    "Strategic suggestion 2"
  ],
  "insights": [
    "Key insight about user's work patterns",
    "Observation about priorities"
  ]
}"""


def create_planner_input(analysis_summary: Dict[str, Any], user_goal: Optional[str] = None) -> str:
    """Create input for planner agent from analysis summary."""
    input_data = {
        "userGoal": user_goal or analysis_summary.get("goalInferred", ""),
        "sessionSummary": analysis_summary.get("resumeSummary", ""),
        "workspaces": analysis_summary.get("workspaces", []),
        "lastStop": analysis_summary.get("lastStop", {}),
        "nextActions": analysis_summary.get("nextActions", []),
        "pendingDecisions": analysis_summary.get("pendingDecisions", []),
        "timestamp": datetime.now().isoformat()
    }
    
    return json.dumps(input_data, indent=2)


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


def call_planner_agent(
    analysis_summary: Dict[str, Any],
    user_goal: Optional[str] = None,
    tool_registry: Optional[ToolRegistry] = None,
    api_key: Optional[str] = None,
    max_tool_iterations: int = 3
) -> Dict[str, Any]:
    """
    Call planner agent with analysis summary and optional tools.
    
    Args:
        analysis_summary: Output from analysis agent
        user_goal: Optional user goal override
        tool_registry: Optional tool registry for calendar/email access
        api_key: Gemini API key
        max_tool_iterations: Maximum tool call iterations
    
    Returns:
        Task planning output with prioritized tasks
    """
    if not GEMINI_AVAILABLE:
        raise ImportError("google-generativeai is not installed.")
    
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key not provided.")
    
    # Configure Gemini
    genai.configure(api_key=api_key)
    model_name = 'gemini-2.0-flash-exp'
    try:
        model = genai.GenerativeModel(model_name)
    except Exception:
        model = genai.GenerativeModel('gemini-1.5-pro')
    
    # Prepare tools
    tools_config = None
    if tool_registry and TOOLS_AVAILABLE:
        functions = tool_registry.get_gemini_functions()
        if functions:
            tools_config = genai.protos.Tool(
                function_declarations=[genai.protos.FunctionDeclaration(**f) for f in functions]
            )
    
    # Create input
    planner_input = create_planner_input(analysis_summary, user_goal)
    full_prompt = f"{PLANNER_PROMPT}\n\nAnalysis Summary:\n{planner_input}"
    
    # Conversation for tool calls
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
                        temperature=0.4,  # Slightly higher for creative planning
                        top_p=0.95,
                        top_k=40,
                    )
                )
            else:
                response = model.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.4,
                        top_p=0.95,
                        top_k=40,
                    )
                )
            
            # Check for function calls
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                
                if hasattr(candidate, 'content') and candidate.content:
                    parts = candidate.content.parts
                    function_calls = [p for p in parts if hasattr(p, 'function_call')]
                    
                    if function_calls and tool_registry:
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
                        continue
            
            # Get final response
            if hasattr(response, 'text') and response.text:
                response_text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                text_parts = []
                for candidate in response.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if hasattr(part, 'text'):
                                text_parts.append(part.text)
                response_text = ' '.join(text_parts)
            else:
                raise ValueError("Planner agent returned empty response")
            
            # Clean and parse JSON
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            elif response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            try:
                result = json.loads(response_text.strip())
                return result
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse planner response as JSON: {e}\nResponse: {response_text}")
                
        except ValueError as e:
            raise
        except Exception as e:
            raise RuntimeError(f"Planner agent call failed: {e}")
    
    raise RuntimeError("Maximum tool call iterations reached")


def planTasks(
    analysis_summary: Dict[str, Any],
    user_goal: Optional[str] = None,
    api_key: Optional[str] = None,
    use_tools: bool = True
) -> Dict[str, Any]:
    """
    Main function to plan tasks from analysis summary.
    
    Args:
        analysis_summary: Output from analyzeSessionWithGemini
        user_goal: Optional user goal override
        api_key: Gemini API key
        use_tools: Whether to enable tool use
    
    Returns:
        Task planning output with prioritized tasks, order, and suggestions
    """
    if not GEMINI_AVAILABLE:
        # Return basic task list from analysis
        return create_basic_task_plan(analysis_summary)
    
    try:
        # Set up tool registry if enabled
        tool_registry = None
        if use_tools and TOOLS_AVAILABLE:
            tool_registry = ToolRegistry()
            for tool in create_calendar_tools():
                tool_registry.register(tool)
            for tool in create_email_tool():
                tool_registry.register(tool)
        
        result = call_planner_agent(
            analysis_summary,
            user_goal=user_goal,
            tool_registry=tool_registry,
            api_key=api_key
        )
        
        # Validate and sanitize result
        return validate_planner_output(result)
        
    except Exception as e:
        print(f"Warning: Planner agent failed ({e}), using basic task plan")
        return create_basic_task_plan(analysis_summary)


def generate_task_description(title: str) -> str:
    """Generate a description for a task based on its title."""
    lower_title = title.lower()
    
    if "resume" in lower_title or "open last stop" in lower_title:
        return "Press the \"Resume Session\" button to reopen the tab or workspace where you left off and continue your work seamlessly."
    if "continue in" in lower_title or "workspace" in lower_title:
        return "Press the \"Resume Session\" button or use \"Continue where you left off\" to return to the workspace you were actively using."
    if "review" in lower_title and "pages" in lower_title:
        return "Review the most visited pages from your session to identify key resources and information you were working with."
    if "review" in lower_title and "tabs" in lower_title:
        return "Go through your recent tabs to see what you were working on and identify any unfinished tasks."
    if "decide:" in lower_title:
        return "Make a decision on this item based on the context from your session and your current priorities."
    if "complete" in lower_title or "finish" in lower_title:
        return "Complete this task that was started during your session to maintain momentum and avoid losing context."
    
    # Default description
    return "Work on this task based on your session activity and current priorities."


def create_basic_task_plan(analysis_summary: Dict[str, Any]) -> Dict[str, Any]:
    """Create a basic task plan from analysis summary (fallback)."""
    next_actions = analysis_summary.get("nextActions", [])
    pending_decisions = analysis_summary.get("pendingDecisions", [])
    
    tasks = []
    task_ids = []
    
    # Convert nextActions to tasks
    for i, action in enumerate(next_actions[:5]):
        task_id = f"task_{i+1}"
        tasks.append({
            "id": task_id,
            "title": action,
            "priority": "medium",
            "urgency": "soon",
            "estimatedTime": "30 minutes",
            "dependencies": [],
            "description": generate_task_description(action),
            "reason": "Suggested from session analysis",
            "context": ""
        })
        task_ids.append(task_id)
    
    # Add pending decisions as tasks
    for i, decision in enumerate(pending_decisions[:3]):
        task_id = f"decision_{i+1}"
        title = f"Decide: {decision}"
        tasks.append({
            "id": task_id,
            "title": title,
            "priority": "high",
            "urgency": "soon",
            "estimatedTime": "15 minutes",
            "dependencies": [],
            "description": generate_task_description(title),
            "reason": "Pending decision from session",
            "context": ""
        })
        task_ids.append(task_id)
    
    return {
        "prioritizedTasks": tasks,
        "taskOrder": task_ids,
        "suggestions": [
            "Review your session summary to understand what you accomplished",
            "Prioritize tasks based on deadlines and importance"
        ],
        "insights": [
            "Tasks generated from session analysis",
            "Consider using calendar to schedule time for these tasks"
        ]
    }


def validate_planner_output(output: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize planner output."""
    if not isinstance(output, dict):
        raise ValueError("Planner output must be a dictionary")
    
    # Ensure required fields
    result = {
        "prioritizedTasks": output.get("prioritizedTasks", []),
        "taskOrder": output.get("taskOrder", []),
        "suggestions": output.get("suggestions", []),
        "insights": output.get("insights", [])
    }
    
    # Validate tasks
    if not isinstance(result["prioritizedTasks"], list):
        result["prioritizedTasks"] = []
    
    # Validate task structure
    valid_tasks = []
    for task in result["prioritizedTasks"]:
        if isinstance(task, dict) and "id" in task and "title" in task:
            valid_task = {
                "id": str(task.get("id", "")),
                "title": str(task.get("title", "")),
                "priority": task.get("priority", "medium"),
                "urgency": task.get("urgency", "soon"),
                "estimatedTime": str(task.get("estimatedTime", "30 minutes")),
                "dependencies": task.get("dependencies", []) if isinstance(task.get("dependencies"), list) else [],
                "reason": str(task.get("reason", "")),
                "context": str(task.get("context", ""))
            }
            valid_tasks.append(valid_task)
    
    result["prioritizedTasks"] = valid_tasks[:10]  # Limit to 10 tasks
    result["taskOrder"] = result["taskOrder"][:10]  # Limit order to 10
    
    # Validate arrays
    result["suggestions"] = [str(s) for s in result["suggestions"][:5]] if isinstance(result["suggestions"], list) else []
    result["insights"] = [str(i) for i in result["insights"][:5]] if isinstance(result["insights"], list) else []
    
    return result


if __name__ == "__main__":
    # Test with example analysis
    test_analysis = {
        "goalInferred": "Prepare for technical interview",
        "workspaces": [
            {"label": "LeetCode", "timeSec": 300, "topUrls": ["https://leetcode.com"]},
            {"label": "Resume", "timeSec": 180, "topUrls": ["https://docs.google.com"]}
        ],
        "resumeSummary": "You spent time practicing coding problems on LeetCode and updating your resume.",
        "lastStop": {"label": "Resume", "url": "https://docs.google.com"},
        "nextActions": [
            "Continue practicing coding problems",
            "Review resume one more time"
        ],
        "pendingDecisions": [
            "Which companies to apply to next"
        ]
    }
    
    print("=== Task Planning Agent Test ===")
    try:
        result = planTasks(test_analysis, use_tools=False)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Error: {e}")

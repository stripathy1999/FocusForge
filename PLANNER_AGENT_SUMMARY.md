# Planning Agent Summary

## Overview

The Planning Agent is the second agent in FocusForge's two-agent architecture. It takes the analysis summary from the Analysis Agent and provides strategic task planning, prioritization, and suggestions.

## Agent Responsibilities

### Primary Functions
1. **Task Prioritization**: Prioritizes tasks by urgency and importance
2. **Task Ordering**: Orders tasks logically (dependencies, sequence)
3. **New Task Suggestions**: Suggests new tasks aligned with user goals
4. **Strategic Guidance**: Provides insights and strategic suggestions
5. **Context Integration**: Uses calendar/email tools for better context

## Input/Output

### Input
Takes the analysis summary from Analysis Agent:
```json
{
  "goalInferred": "string",
  "workspaces": [...],
  "resumeSummary": "string",
  "lastStop": {...},
  "nextActions": [...],
  "pendingDecisions": [...]
}
```

### Output
Returns task planning JSON:
```json
{
  "prioritizedTasks": [
    {
      "id": "task_1",
      "title": "Specific actionable task",
      "priority": "high" | "medium" | "low",
      "urgency": "urgent" | "soon" | "later",
      "estimatedTime": "30 minutes",
      "dependencies": ["task_2"],
      "reason": "Why this task is important",
      "context": "Additional context from tools"
    }
  ],
  "taskOrder": ["task_1", "task_2", "task_3"],
  "suggestions": ["Strategic suggestion 1", "Strategic suggestion 2"],
  "insights": ["Key insight 1", "Key insight 2"]
}
```

## Key Features

### 1. Intelligent Prioritization
- **Priority**: high, medium, low (based on importance)
- **Urgency**: urgent, soon, later (based on deadlines)
- **Dependencies**: Tasks that must be done first
- **Context**: Uses calendar/email for better prioritization

### 2. Logical Ordering
- Orders tasks by dependencies
- Sequences related tasks together
- Considers prerequisites
- Optimizes workflow

### 3. Strategic Suggestions
- Suggests new tasks aligned with goals
- Provides strategic guidance
- Offers insights about work patterns
- Recommends scheduling and planning

### 4. Tool Integration
- **Calendar**: Checks upcoming events, suggests meeting times
- **Email**: Checks for relevant emails, drafts emails
- Uses tools contextually to improve suggestions

## API Endpoints

### GET /api/session/:id/plan
Gets task plan for a session.

**Response:**
```json
{
  "sessionId": "uuid",
  "analysis": {...},
  "taskPlan": {
    "prioritizedTasks": [...],
    "taskOrder": [...],
    "suggestions": [...],
    "insights": [...]
  }
}
```

### POST /api/plan (Internal)
Calls the planning agent directly.

**Body:**
```json
{
  "analysisSummary": {...},
  "userGoal": "optional goal"
}
```

## Usage Example

```python
from agent_planner import planTasks
from gemini_analyzer import analyzeSessionWithGemini

# Step 1: Analysis Agent
events = {"events": [...]}
analysis = analyzeSessionWithGemini("", events)

# Step 2: Planning Agent
task_plan = planTasks(
    analysis,
    user_goal=None,
    use_tools=True
)

# Use task plan
for task in task_plan["prioritizedTasks"]:
    print(f"{task['priority']}: {task['title']}")
```

## Agent Comparison

| Feature | Analysis Agent | Planning Agent |
|---------|---------------|----------------|
| **Input** | Browser events | Analysis summary |
| **Output** | Session summary | Task plan |
| **Focus** | What happened | What to do next |
| **Temperature** | 0.3 (structured) | 0.4 (creative) |
| **Tools** | Optional | Recommended |
| **Purpose** | Understand past | Plan future |

## Fallback Behavior

- If Gemini unavailable → Uses basic task plan from analysis
- If tools unavailable → Works without tools
- If planning fails → Returns basic task list
- Always returns valid output

## Testing

Run test suite:
```bash
python test_planner.py
```

Tests cover:
- Basic planning functionality
- Task structure validation
- Fallback behavior
- Integration with analysis

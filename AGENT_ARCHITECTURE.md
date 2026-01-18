# FocusForge Agent Architecture

## Two-Agent System

FocusForge uses a two-agent architecture with distinct responsibilities:

### Agent 1: Analysis Agent (Existing)
**File**: `gemini_analyzer.py`, `gemini_analyzer_with_tools.py`

**Responsibilities:**
- Gathers information from browser events
- Generates session summaries
- Identifies workspaces and activities
- Infers goals from behavior
- Creates structured analysis JSON

**Input**: Browser events (URLs, titles, timestamps, durations)
**Output**: Analysis summary JSON with:
- `goalInferred`
- `workspaces`
- `resumeSummary`
- `lastStop`
- `nextActions` (basic)
- `pendingDecisions` (basic)

**Tools**: Optional calendar/email access for context

---

### Agent 2: Planning Agent (New)
**File**: `agent_planner.py`

**Responsibilities:**
- Takes analysis summary and provides strategic planning
- Prioritizes tasks by urgency and importance
- Orders tasks logically (dependencies, sequence)
- Suggests new tasks aligned with goals
- Provides strategic guidance and insights
- Uses calendar/email for contextual suggestions

**Input**: Analysis summary from Agent 1
**Output**: Task planning JSON with:
- `prioritizedTasks` - List of tasks with priority, urgency, dependencies
- `taskOrder` - Recommended execution order
- `suggestions` - Strategic suggestions
- `insights` - Key observations

**Tools**: Calendar and email access for better context

---

## Agent Flow

```
Browser Events
    ↓
[Agent 1: Analysis Agent]
    ↓
Analysis Summary JSON
    ↓
[Agent 2: Planning Agent]
    ↓
Task Plan with Prioritized Tasks
    ↓
User Interface
```

## Integration

### Backend Integration

The backend can call both agents sequentially:

```typescript
// 1. Analysis Agent
const analysis = await callAnalysisAgent(events);

// 2. Planning Agent
const taskPlan = await callPlanningAgent(analysis);
```

### API Endpoint

Create: `POST /api/session/:id/plan`

```typescript
// Get analysis
const analysis = await getAnalysis(sessionId);

// Get task plan
const taskPlan = await callPlanningAgent(analysis);

return { analysis, taskPlan };
```

## Agent Comparison

| Feature | Analysis Agent | Planning Agent |
|---------|---------------|----------------|
| **Input** | Browser events | Analysis summary |
| **Output** | Session summary | Task plan |
| **Focus** | What happened | What to do next |
| **Tools** | Optional (context) | Recommended (planning) |
| **Temperature** | 0.3 (structured) | 0.4 (creative) |
| **Purpose** | Understand past | Plan future |

## Example Flow

### Step 1: Analysis Agent
```json
{
  "goalInferred": "Job application preparation",
  "resumeSummary": "You were switching between updating your resume and researching companies",
  "nextActions": ["Continue resume updates", "Research more companies"]
}
```

### Step 2: Planning Agent
```json
{
  "prioritizedTasks": [
    {
      "id": "task_1",
      "title": "Finalize resume updates",
      "priority": "high",
      "urgency": "urgent",
      "dependencies": [],
      "reason": "Resume is needed for applications"
    },
    {
      "id": "task_2",
      "title": "Research target companies",
      "priority": "medium",
      "urgency": "soon",
      "dependencies": ["task_1"],
      "reason": "Should have resume ready before researching"
    }
  ],
  "taskOrder": ["task_1", "task_2"],
  "suggestions": [
    "Schedule 2 hours tomorrow morning for resume finalization",
    "Create a spreadsheet to track company research"
  ]
}
```

## Benefits of Two-Agent Architecture

1. **Separation of Concerns**: Each agent has a clear, focused responsibility
2. **Modularity**: Can improve/swap agents independently
3. **Flexibility**: Can use analysis without planning, or vice versa
4. **Specialization**: Each agent optimized for its task
5. **Tool Usage**: Planning agent can use tools more strategically

## Future Enhancements

- **Agent 3**: Execution Agent (actually performs tasks)
- **Agent Communication**: Agents can query each other
- **Learning**: Agents learn from user feedback
- **Multi-Agent Collaboration**: Agents work together on complex tasks

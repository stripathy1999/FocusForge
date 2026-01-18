# AI Analysis System Summary

## Overview
The AI analysis system transforms raw browser tracking events into intelligent, structured summaries that help users understand and resume their work sessions.

## Core Components

### 1. Basic Analyzer (`analyzer.py`)
**Purpose**: Fast, rule-based analysis that works without AI

**Key Functions:**
- **Domain Extraction**: Extracts clean domain names from URLs (removes www., handles subdomains)
- **Domain Grouping**: Groups browser events by domain and calculates total time spent per domain
- **Workspace Creation**: Creates up to 5 "workspaces" (domains) sorted by time spent
- **Top URLs Identification**: Finds the most-visited URLs within each workspace
- **Last Stop Detection**: Identifies the last page the user was on
- **Basic Goal Inference**: Simple goal inference based on top domain

**Output**: Structured JSON with basic workspace information and simple summaries

### 2. Gemini-Enhanced Analyzer (`gemini_analyzer.py`)
**Purpose**: AI-powered intelligent analysis that enhances basic analysis with natural language understanding

**Key Functions:**

#### Service Name Extraction
- Extracts human-readable service names from URLs
- Handles complex subdomains (e.g., "explore.jobs.netflix.net" → "Netflix")
- Provides context for AI to use service names instead of URLs

#### Enhanced Input Preparation
- Enriches events with domain and service name information
- Adds service context to workspaces
- Prepares structured input for Gemini AI

#### Gemini AI Integration
- **Natural Language Summaries**: Generates conversational, human-readable summaries
  - Groups activities by intention/purpose (not just domains)
  - Uses service names instead of URLs
  - Describes what user was doing, not where they were browsing
  - Example: "You were switching between designing on Canva and applying for jobs on Netflix"
  
- **Goal Inference**: Intelligently infers user's goal from browsing patterns
  
- **Next Actions**: Suggests up to 5 actionable next steps (each starts with a verb)
  
- **Pending Decisions**: Identifies up to 3 decisions the user needs to make
  
- **Workspace Labeling**: Creates human-friendly labels for workspaces
  
- **Validation**: Ensures output matches schema and constraints

#### Fallback System
- If Gemini fails → falls back to basic analyzer
- If Gemini unavailable → uses basic analyzer
- Always returns valid output

## Input Format

```json
{
  "goal": "Optional user-provided goal",
  "events": [
    {
      "ts": 1730000000000,
      "url": "https://example.com/page",
      "title": "Page Title",
      "durationSec": 90
    }
  ]
}
```

## Output Format

```json
{
  "goalInferred": "AI-inferred or user-provided goal",
  "workspaces": [
    {
      "label": "Human-friendly workspace name",
      "timeSec": 300,
      "topUrls": ["url1", "url2", ...]
    }
  ],
  "resumeSummary": "Natural language summary of session (1-2 sentences)",
  "lastStop": {
    "label": "Last page title or domain",
    "url": "Last page URL"
  },
  "nextActions": [
    "Actionable next steps (max 5)"
  ],
  "pendingDecisions": [
    "Decisions to make (max 3)"
  ]
}
```

## Key Features

### 1. Domain-Based Organization
- Automatically groups related websites together
- Calculates time spent per domain
- Identifies most important URLs

### 2. Intelligent Summarization
- **Natural Language**: Conversational summaries, not technical lists
- **Activity Grouping**: Groups by intention (e.g., "job searching" not "visited 5 job sites")
- **Service Names**: Uses "Canva" not "www.canva.com"
- **Action-Oriented**: Describes what user was doing

### 3. Goal Inference
- Analyzes browsing patterns to infer user intent
- Can work with or without user-provided goal
- Provides context-aware goal suggestions

### 4. Actionable Insights
- **Next Actions**: Specific, actionable steps to continue work
- **Pending Decisions**: Identifies decisions that need to be made
- **Resume Context**: Helps user quickly understand where they left off

### 5. Robust Error Handling
- Validates all outputs against schema
- Falls back gracefully if AI fails
- Ensures valid JSON always returned
- Handles edge cases (empty sessions, single events, etc.)

## Processing Flow

1. **Receive Events**: Gets browser events with timestamps, URLs, titles, durations
2. **Domain Analysis**: Groups events by domain, calculates time spent
3. **Workspace Creation**: Creates up to 5 workspaces sorted by importance
4. **Service Extraction**: Extracts service names for better context
5. **AI Enhancement** (if available):
   - Prepares enriched input for Gemini
   - Calls Gemini API with detailed prompt
   - Validates and sanitizes response
6. **Fallback** (if AI unavailable/fails):
   - Uses basic analyzer
   - Returns simple but valid output
7. **Output**: Returns structured JSON matching schema

## Constraints & Limits

- **Workspaces**: Maximum 5
- **Next Actions**: Maximum 5, each must start with a verb
- **Pending Decisions**: Maximum 3
- **Resume Summary**: 1-2 sentences, natural language
- **Validation**: All URLs in output must exist in input events
- **No Fabrication**: Cannot invent websites, events, or facts

## Example Transformations

### Input
```json
{
  "goal": "",
  "events": [
    {"ts": 1000, "url": "https://www.canva.com/design", "title": "Design", "durationSec": 300},
    {"ts": 1300, "url": "https://explore.jobs.netflix.net/apply", "title": "Apply", "durationSec": 200}
  ]
}
```

### Output (with Gemini)
```json
{
  "goalInferred": "Creating designs and applying for jobs",
  "workspaces": [
    {"label": "Design Work", "timeSec": 300, "topUrls": ["https://www.canva.com/design"]},
    {"label": "Job Applications", "timeSec": 200, "topUrls": ["https://explore.jobs.netflix.net/apply"]}
  ],
  "resumeSummary": "You were switching between designing on Canva and applying for jobs on Netflix",
  "lastStop": {"label": "Apply", "url": "https://explore.jobs.netflix.net/apply"},
  "nextActions": [
    "Continue design work on Canva",
    "Review Netflix job application status"
  ],
  "pendingDecisions": [
    "Choose which design to finalize",
    "Decide on job application priority"
  ]
}
```

## Dependencies

- **Basic**: Python standard library only
- **Enhanced**: Requires `google-generativeai` package
- **Graceful Degradation**: Works without Gemini (uses basic analyzer)

## Use Cases

1. **Session Resumption**: Help users quickly understand what they were doing
2. **Goal Tracking**: Infer and track user goals from behavior
3. **Productivity Insights**: Identify patterns and suggest improvements
4. **Context Switching**: Understand when user switches between tasks
5. **Decision Support**: Identify pending decisions that need attention

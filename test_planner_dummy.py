#!/usr/bin/env python3
"""
Test script for planning agent with dummy session data
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent_planner import planTasks

# Dummy analysis summary
dummy_analysis = {
    "goalInferred": "Preparing for software engineering interviews",
    "workspaces": [
        {
            "label": "LeetCode Practice",
            "timeSec": 1800,  # 30 minutes
            "topUrls": [
                "https://leetcode.com/problems/two-sum",
                "https://leetcode.com/problems/valid-parentheses"
            ]
        },
        {
            "label": "Documentation Study",
            "timeSec": 1200,  # 20 minutes
            "topUrls": [
                "https://docs.python.org/3/",
                "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
            ]
        },
        {
            "label": "Interview Prep",
            "timeSec": 900,  # 15 minutes
            "topUrls": [
                "https://www.glassdoor.com/Interview/software-engineer-interview-questions-SRCH_KO0,18.htm"
            ]
        }
    ],
    "resumeSummary": "You spent time practicing coding problems on LeetCode, studying Python and JavaScript documentation, and researching common interview questions.",
    "lastStop": {
        "label": "LeetCode - Two Sum",
        "url": "https://leetcode.com/problems/two-sum"
    },
    "nextActions": [
        "Complete the two-sum problem solution",
        "Review time complexity analysis",
        "Practice more array problems"
    ],
    "pendingDecisions": [
        "Choose focus area: Data structures vs Algorithms",
        "Decide on study schedule for next week"
    ]
}

def main():
    print("🧪 Testing Planning Agent with Dummy Session Data\n")
    print("Analysis Summary:")
    print(json.dumps(dummy_analysis, indent=2))
    print("\n" + "=" * 60 + "\n")
    
    try:
        # Call planning agent
        result = planTasks(
            dummy_analysis,
            user_goal="Prepare for software engineering interviews",
            api_key=os.getenv('GEMINI_API_KEY'),
            use_tools=False  # Disable tools for testing
        )
        
        print("✅ Planning Agent Response:\n")
        print(json.dumps(result, indent=2))
        print("\n" + "=" * 60 + "\n")
        
        # Pretty print tasks
        if result.get("prioritizedTasks"):
            print("📋 Prioritized Tasks:\n")
            for i, task in enumerate(result["prioritizedTasks"], 1):
                print(f"{i}. {task.get('title', 'N/A')}")
                print(f"   Priority: {task.get('priority', 'N/A')} | Urgency: {task.get('urgency', 'N/A')}")
                if task.get('estimatedTime'):
                    print(f"   ⏱️  Estimated: {task['estimatedTime']}")
                if task.get('reason'):
                    print(f"   💡 Reason: {task['reason']}")
                if task.get('dependencies'):
                    print(f"   🔗 Depends on: {', '.join(task['dependencies'])}")
                print()
        
        if result.get("suggestions"):
            print("💬 Strategic Suggestions:\n")
            for i, suggestion in enumerate(result["suggestions"], 1):
                print(f"   {i}. {suggestion}")
            print()
        
        if result.get("insights"):
            print("🔍 Insights:\n")
            for i, insight in enumerate(result["insights"], 1):
                print(f"   {i}. {insight}")
            print()
        
        if result.get("taskOrder"):
            print("📊 Recommended Task Order:\n")
            for i, task_id in enumerate(result["taskOrder"], 1):
                task = next((t for t in result.get("prioritizedTasks", []) if t.get("id") == task_id), None)
                print(f"   {i}. {task.get('title', task_id) if task else task_id}")
        
    except Exception as e:
        print(f"❌ Error testing planning agent: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

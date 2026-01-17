#!/usr/bin/env python3
"""
Test script for the planning agent.
"""
import json
import sys

sys.path.insert(0, '.')

def test_planner():
    """Test the planning agent."""
    print("=" * 60)
    print("Testing Planning Agent")
    print("=" * 60)
    
    from agent_planner import planTasks, create_basic_task_plan
    
    # Test analysis summary (output from analysis agent)
    test_analysis = {
        "goalInferred": "Prepare for technical interview",
        "workspaces": [
            {"label": "LeetCode", "timeSec": 300, "topUrls": ["https://leetcode.com"]},
            {"label": "Resume", "timeSec": 180, "topUrls": ["https://docs.google.com"]}
        ],
        "resumeSummary": "You spent time practicing coding problems on LeetCode and updating your resume for the interview.",
        "lastStop": {"label": "Resume", "url": "https://docs.google.com"},
        "nextActions": [
            "Continue practicing coding problems",
            "Review resume one more time",
            "Research the company"
        ],
        "pendingDecisions": [
            "Which companies to apply to next",
            "What to focus on in interview prep"
        ]
    }
    
    print("\n1. Input Analysis Summary:")
    print(json.dumps(test_analysis, indent=2))
    
    print("\n2. Calling Planning Agent...")
    try:
        result = planTasks(
            test_analysis,
            user_goal=None,
            use_tools=False  # Test without tools first
        )
        
        print("\n3. Planning Agent Output:")
        print(json.dumps(result, indent=2))
        
        # Validate output
        print("\n4. Validation:")
        assert "prioritizedTasks" in result, "Should have prioritizedTasks"
        assert "taskOrder" in result, "Should have taskOrder"
        assert "suggestions" in result, "Should have suggestions"
        assert "insights" in result, "Should have insights"
        
        print(f"   ✓ prioritizedTasks: {len(result['prioritizedTasks'])} tasks")
        print(f"   ✓ taskOrder: {len(result['taskOrder'])} tasks ordered")
        print(f"   ✓ suggestions: {len(result['suggestions'])} suggestions")
        print(f"   ✓ insights: {len(result['insights'])} insights")
        
        # Check task structure
        if result['prioritizedTasks']:
            task = result['prioritizedTasks'][0]
            required_fields = ['id', 'title', 'priority', 'urgency', 'estimatedTime', 'dependencies', 'reason']
            for field in required_fields:
                assert field in task, f"Task should have {field}"
            print(f"   ✓ Task structure valid")
        
        print("\n✅ Planning Agent tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_basic_fallback():
    """Test basic fallback when Gemini unavailable."""
    print("\n" + "=" * 60)
    print("Testing Basic Fallback")
    print("=" * 60)
    
    from agent_planner import create_basic_task_plan
    
    test_analysis = {
        "nextActions": ["Action 1", "Action 2"],
        "pendingDecisions": ["Decision 1"]
    }
    
    result = create_basic_task_plan(test_analysis)
    
    assert "prioritizedTasks" in result
    assert len(result["prioritizedTasks"]) > 0
    print(f"✓ Basic fallback works: {len(result['prioritizedTasks'])} tasks")
    
    return True


if __name__ == "__main__":
    results = []
    results.append(test_planner())
    results.append(test_basic_fallback())
    
    print("\n" + "=" * 60)
    if all(results):
        print("✅ ALL TESTS PASSED!")
    else:
        print("❌ SOME TESTS FAILED")
    print("=" * 60)

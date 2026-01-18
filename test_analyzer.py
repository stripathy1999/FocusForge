"""
Test file with mocked events for testing the analyzer.
"""
import json
from analyzer import analyzeSession
from gemini_analyzer import analyzeSessionWithGemini


def test_basic_analysis():
    """Test basic domain grouping without Gemini."""
    print("=" * 60)
    print("TEST 1: Basic Analysis (Domain Grouping)")
    print("=" * 60)
    
    test_input = {
        "goal": "",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum - LeetCode", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://docs.google.com/document/d/123", "title": "Resume Draft", "durationSec": 240},
            {"ts": 1730000000330, "url": "https://leetcode.com/problems/valid-parentheses", "title": "Valid Parentheses - LeetCode", "durationSec": 120}
        ]
    }
    
    result = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result, indent=2))
    print()


def test_multiple_domains():
    """Test with multiple domains."""
    print("=" * 60)
    print("TEST 2: Multiple Domains")
    print("=" * 60)
    
    test_input = {
        "goal": "Job application preparation",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://linkedin.com/jobs/12345", "title": "Software Engineer Job", "durationSec": 180},
            {"ts": 1730000000270, "url": "https://github.com/user/repo", "title": "My Repository", "durationSec": 300},
            {"ts": 1730000000570, "url": "https://docs.google.com/document/d/abc", "title": "Cover Letter", "durationSec": 150},
            {"ts": 1730000000720, "url": "https://leetcode.com/problems/array", "title": "Array Problems", "durationSec": 100},
            {"ts": 1730000000820, "url": "https://stackoverflow.com/questions/123", "title": "Python Question", "durationSec": 200}
        ]
    }
    
    result = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result, indent=2))
    print()


def test_empty_events():
    """Test with empty events."""
    print("=" * 60)
    print("TEST 3: Empty Events")
    print("=" * 60)
    
    test_input = {
        "goal": "Test goal",
        "events": []
    }
    
    result = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result, indent=2))
    print()


def test_with_goal():
    """Test with a provided goal."""
    print("=" * 60)
    print("TEST 4: With Explicit Goal")
    print("=" * 60)
    
    test_input = {
        "goal": "Prepare for technical interview at Google",
        "events": [
            {"ts": 1730000000000, "url": "https://leetcode.com/problems/two-sum", "title": "Two Sum", "durationSec": 90},
            {"ts": 1730000000090, "url": "https://leetcode.com/problems/valid-parentheses", "title": "Valid Parentheses", "durationSec": 120},
            {"ts": 1730000000210, "url": "https://docs.google.com/document/d/resume", "title": "My Resume", "durationSec": 300}
        ]
    }
    
    result = analyzeSession(test_input["goal"], test_input)
    print(json.dumps(result, indent=2))
    print()


if __name__ == "__main__":
    test_basic_analysis()
    test_multiple_domains()
    test_empty_events()
    test_with_goal()
    
    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)
    print("\nTo test with Gemini, set GEMINI_API_KEY environment variable and run:")
    print("  python gemini_analyzer.py")
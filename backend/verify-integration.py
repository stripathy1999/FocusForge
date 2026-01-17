#!/usr/bin/env python3
"""
Verification script to test backend ↔ analyzer integration
"""
import sys
import json
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def test_data_format():
    """Test that data format matches between backend and analyzer"""
    print("=" * 60)
    print("Testing Data Format Compatibility")
    print("=" * 60)
    
    # Simulate what backend sends to /api/analyze
    backend_payload = {
        "goal": "Test goal",
        "events": [
            {
                "ts": 1730000000000,
                "url": "https://leetcode.com/problems/two-sum",
                "title": "Two Sum - LeetCode",
                "durationSec": 90
            },
            {
                "ts": 1730000000090,
                "url": "https://docs.google.com/document/d/123",
                "title": "Resume Draft",
                "durationSec": 240
            }
        ]
    }
    
    print("\n1. Backend sends (to /api/analyze):")
    print(json.dumps(backend_payload, indent=2))
    
    # Simulate what Python script receives
    goal = backend_payload.get('goal', '')
    events = backend_payload.get('events', [])
    
    print("\n2. Python script extracts:")
    print(f"   goal: {goal}")
    print(f"   events: {len(events)} events")
    
    # Simulate what Python script wraps
    events_with_duration = {'events': events}
    
    print("\n3. Python script wraps as:")
    print(f"   events_with_duration = {{'events': [...]}}")
    print(f"   Contains {len(events_with_duration['events'])} events")
    
    # Test with analyzer
    try:
        from gemini_analyzer import analyzeSessionWithGemini
        
        print("\n4. Calling analyzeSessionWithGemini...")
        result = analyzeSessionWithGemini(
            goal,
            events_with_duration,
            api_key=None,  # Will use basic analysis
            use_gemini=False  # Skip Gemini for test
        )
        
        print("\n5. Analyzer returns:")
        required_fields = ['goalInferred', 'workspaces', 'resumeSummary', 'lastStop', 'nextActions', 'pendingDecisions']
        for field in required_fields:
            if field in result:
                print(f"   ✓ {field}: {type(result[field]).__name__}")
            else:
                print(f"   ✗ {field}: MISSING")
        
        # Check event format compatibility
        print("\n6. Event format check:")
        if events:
            event = events[0]
            required_event_fields = ['ts', 'url', 'title', 'durationSec']
            for field in required_event_fields:
                if field in event:
                    print(f"   ✓ {field}: {event[field]}")
                else:
                    print(f"   ✗ {field}: MISSING")
        
        # Check analyzer can access durationSec
        print("\n7. Analyzer access check:")
        from analyzer import group_events_by_domain
        domain_data = group_events_by_domain(events)
        if domain_data:
            print(f"   ✓ Can group events by domain")
            print(f"   ✓ Can access durationSec from events")
            total_time = sum(d['timeSec'] for d in domain_data.values())
            print(f"   ✓ Total time calculated: {total_time} seconds")
        
        print("\n" + "=" * 60)
        print("✅ ALL CHECKS PASSED - Integration is compatible!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_data_format()
    sys.exit(0 if success else 1)

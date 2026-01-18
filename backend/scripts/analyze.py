#!/usr/bin/env python3
"""
Standalone Python script for analysis that can be called from Node.js
"""
import sys
import json
import os

# Add parent directory to path to import analyzer modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from gemini_analyzer import analyzeSessionWithGemini
except ImportError as e:
    print(json.dumps({"error": f"Failed to import analyzer: {e}"}), file=sys.stderr)
    sys.exit(1)

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        goal = input_data.get('goal', '')
        events = input_data.get('events', [])
        
        events_with_duration = {'events': events}
        
        # Get API key from environment
        api_key = os.getenv('GEMINI_API_KEY')
        
        # Run analysis
        result = analyzeSessionWithGemini(
            goal, 
            events_with_duration, 
            api_key=api_key, 
            use_gemini=True
        )
        
        # Output result as JSON
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

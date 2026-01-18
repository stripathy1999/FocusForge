#!/usr/bin/env python3
"""
Standalone HTTP server for Python analyzer.
Can be deployed separately (Railway, Render, Fly.io, etc.)
"""
import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

try:
    from gemini_analyzer import analyzeSessionWithGemini
except ImportError as e:
    print(f"Error importing analyzer: {e}", file=sys.stderr)
    sys.exit(1)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok"})

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze session events"""
    try:
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        goal = data.get('goal', '')
        events = data.get('events', [])
        
        if not isinstance(events, list):
            return jsonify({"error": "events must be an array"}), 400
        
        # Run analysis
        result = analyzeSessionWithGemini(
            goal,
            {'events': events},
            api_key=os.getenv('GEMINI_API_KEY'),
            use_gemini=True
        )
        
        return jsonify(result)
    except Exception as e:
        print(f"Analysis error: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('DEBUG', 'False').lower() == 'true')

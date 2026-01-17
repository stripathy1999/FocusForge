"""
Tool registry for managing available tools for the AI agent.
"""
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass


@dataclass
class Tool:
    """Represents a tool that can be called by the AI agent."""
    name: str
    description: str
    parameters: Dict[str, Any]  # JSON schema for parameters
    handler: Callable  # Function to execute the tool
    
    def to_gemini_function(self) -> Dict[str, Any]:
        """Convert tool to Gemini function calling format."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "object",
                "properties": self.parameters.get("properties", {}),
                "required": self.parameters.get("required", [])
            }
        }


class ToolRegistry:
    """Registry for managing available tools."""
    
    def __init__(self):
        self.tools: Dict[str, Tool] = {}
    
    def register(self, tool: Tool):
        """Register a tool."""
        self.tools[tool.name] = tool
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self.tools.get(name)
    
    def list_tools(self) -> List[Tool]:
        """List all registered tools."""
        return list(self.tools.values())
    
    def get_gemini_functions(self) -> List[Dict[str, Any]]:
        """Get all tools in Gemini function calling format."""
        return [tool.to_gemini_function() for tool in self.tools.values()]

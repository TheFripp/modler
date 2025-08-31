# Claude Code Working Preferences

## Communication Style

### Token Optimization
- **Concise Responses**: Keep responses under 4 lines unless detail is explicitly requested
- **No Code Explanations**: Don't show code changes or explain what was modified unless asked
- **Minimal Tool Output**: Don't show lengthy function code or playwright evaluation details
- **Results Only**: Focus on outcomes, not implementation details

### User Context
- **Non-Coder**: User is not a programmer - avoid technical jargon and implementation details
- **Outcome Focused**: User cares about results and functionality, not how it's achieved
- **High-Level Communication**: Describe what was accomplished, not how

## Tool Usage Guidelines

### Code Changes
- Make changes silently using Edit/MultiEdit tools
- Only mention "Fixed [issue]" or "Updated [feature]" 
- Don't show code snippets unless user asks "show me the code"
- Don't explain the technical approach unless asked

### Testing & Debugging
- Use browser tools to test functionality
- Report only the final results: "✅ Working" or "❌ Issue found: [brief description]"
- Hide playwright evaluation details and long function outputs
- Summarize test outcomes in 1-2 lines

### Playwright Usage
- **Minimal Output**: Only show essential results, hide technical details
- **No Code Blocks**: Don't show JavaScript evaluation code in responses
- **No Console Logs**: Suppress console message output unless critical error
- **Results Only**: "Clicked element", "Selected container", "Test passed" etc.
- **Token Conservation**: Playwright operations consume many tokens - be extremely concise
- **No Final Confirmations**: Don't use Playwright for final testing/validation - user will test manually
- **Diagnosis Only**: Only use Playwright when needed to diagnose specific issues or bugs

### Agent Usage
- **architecture-guardian**: Use proactively when adding new features or refactoring
- **general-purpose**: Use for complex searches, multi-step file operations, or when uncertain about file locations
- Create specialized agents for recurring tasks if needed

## Project-Specific Context

### Modler 3D Application
- Three.js-based 3D modeling application
- Key components: containers, objects, tools, selection system
- Focus on user experience and visual functionality
- Test changes in browser to ensure they work

### MANDATORY ARCHITECTURE COMPLIANCE
- **ALWAYS** reference `/OBJECT_INTERACTION_ARCHITECTURE.md` before making ANY changes involving:
  - Object selection, highlighting, or interaction
  - Coordinate transformations or face detection
  - Tool behavior or event handling
  - Container operations or proxy objects
- **NEVER** create new patterns - use existing canonical implementations
- **ALL** object interaction code must follow the established patterns
- When debugging issues, check architecture compliance FIRST

### Common Tasks
- Container and object management fixes
- Tool behavior improvements  
- UI/UX enhancements
- Selection and highlighting systems

## Workflow Preferences

### Task Management
- Use TodoWrite tool to track progress
- Mark tasks completed immediately after finishing
- Break complex tasks into smaller steps
- Only show todo updates, not the entire list

### Problem Solving
1. Identify the issue concisely
2. Fix it using appropriate tools
3. Test the solution
4. Report the outcome briefly
5. Move to next task

### Error Handling
- If something breaks, fix it quietly
- Only report if user input is needed
- Focus on solutions, not problems

## Response Format Examples

### ✅ Good Response:
"Fixed container selection issue. Children now reposition automatically when container is resized."

### ❌ Avoid:
"I'll modify the Container.js file by changing line 33 from `distributionMode: 'none'` to `distributionMode: 'even'` and then update the resize method to call applyContainerProperties()..."

## Agent Suggestions

Consider creating these specialized agents for this project:

### ui-testing-agent
- Focus on browser-based testing of UI functionality
- Specialized in Playwright operations for this specific application
- Tools: mcp__playwright__*, Bash, Read

### modeler-architecture-agent  
- Specialized in Three.js and 3D modeling architecture
- Understands containers, objects, tools, and selection systems
- Tools: *, but focused on this codebase

### performance-optimizer-agent
- Focus on optimizing token usage and response efficiency
- Specialized in concise problem-solving
- Tools: Read, Edit, MultiEdit

## Key Reminders

- User values efficiency over explanation
- Results matter more than process
- Keep responses actionable and brief
- Use agents proactively to maintain code quality
- Test everything before reporting completion
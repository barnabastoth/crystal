import { parseTimestamp } from './timestampUtils';

interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface PendingToolCall {
  call: ToolCall;
  timestamp: string;
  startTime: number;
}

// Store pending tool calls to match with their results
const pendingToolCalls = new Map<string, PendingToolCall>();

// Loading animation frames
const LOADING_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
const DOTS_ANIMATION = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let currentFrame = 0;

// Track active tool execution
const activeTools = new Map<string, { name: string; startTime: number; frame: number }>();

// Format duration in human-readable format
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// Get next animation frame
function getLoadingAnimation(): string {
  const frame = LOADING_FRAMES[currentFrame % LOADING_FRAMES.length];
  currentFrame++;
  return frame;
}

// Make paths relative for cleaner display
function makePathsRelative(content: any, gitRepoPath?: string): string {
  if (typeof content !== 'string') {
    if (content === null || content === undefined) return '';
    content = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
  }
  
  if (!gitRepoPath) return content;
  
  const pathRegex = /([\\/](?:Users|home|var|tmp|mnt|opt)[\\/][^\s\n]+)/g;
  
  return content.replace(pathRegex, (match: string) => {
    try {
      const worktreeMatch = match.match(/worktrees[\\/][^\/]+/);
      if (worktreeMatch) {
        const afterWorktree = match.substring(match.indexOf(worktreeMatch[0]) + worktreeMatch[0].length);
        return afterWorktree;
      }
      
      if (match.includes(gitRepoPath)) {
        const relativePath = match.replace(gitRepoPath, '');
        return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      }
      
      return match;
    } catch {
      return match;
    }
  });
}

/**
 * Format tool call in a compact, user-friendly way
 */
export function formatCompactToolCall(
  toolCall: ToolCall,
  isActive: boolean = false,
  gitRepoPath?: string
): string {
  const timestamp = new Date().toLocaleTimeString();
  
  // Track active tool
  if (isActive && !activeTools.has(toolCall.id)) {
    activeTools.set(toolCall.id, {
      name: toolCall.name,
      startTime: Date.now(),
      frame: 0
    });
  }
  
  let output = '';
  
  // Get loading state if active
  if (isActive) {
    const toolState = activeTools.get(toolCall.id);
    if (toolState) {
      const elapsed = Math.floor((Date.now() - toolState.startTime) / 1000);
      const frame = LOADING_FRAMES[toolState.frame % LOADING_FRAMES.length];
      toolState.frame++;
      
      output = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[33m${frame}\x1b[0m \x1b[1m${toolCall.name}\x1b[0m`;
      output += ` \x1b[36m[${formatDuration(elapsed)}]\x1b[0m`;
    }
  } else {
    output = `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[1m🔧 ${toolCall.name}\x1b[0m`;
  }
  
  // Add compact parameters inline
  if (toolCall.input) {
    const input = toolCall.input;
    
    // Tool-specific compact formatting
    switch(toolCall.name) {
      case 'Read':
        if (input.file_path) {
          output += ` \x1b[90m→ ${makePathsRelative(input.file_path, gitRepoPath)}\x1b[0m`;
          if (input.offset && input.limit) {
            output += ` \x1b[90m[lines ${input.offset}-${input.offset + input.limit}]\x1b[0m`;
          }
        }
        break;
        
      case 'Edit':
      case 'Write':
        if (input.file_path) {
          output += ` \x1b[90m→ ${makePathsRelative(input.file_path, gitRepoPath)}\x1b[0m`;
        }
        break;
        
      case 'MultiEdit':
        if (input.file_path && input.edits) {
          output += ` \x1b[90m→ ${makePathsRelative(input.file_path, gitRepoPath)}\x1b[0m`;
          output += ` \x1b[90m[${input.edits.length} changes]\x1b[0m`;
        }
        break;
        
      case 'Grep':
      case 'Search':
        if (input.pattern) {
          const pattern = input.pattern.length > 30 ? 
            input.pattern.substring(0, 30) + '...' : input.pattern;
          output += ` \x1b[90m→ "${pattern}"\x1b[0m`;
          if (input.path) {
            output += ` \x1b[90min ${makePathsRelative(input.path, gitRepoPath)}\x1b[0m`;
          }
        }
        break;
        
      case 'Bash':
        if (input.command) {
          const cmd = input.command.length > 50 ? 
            input.command.substring(0, 50) + '...' : input.command;
          output += ` \x1b[90m→ $ ${cmd}\x1b[0m`;
        }
        break;
        
      case 'TodoWrite':
        if (input.todos) {
          const completed = input.todos.filter((t: any) => t.status === 'completed').length;
          const inProgress = input.todos.filter((t: any) => t.status === 'in_progress').length;
          const total = input.todos.length;
          output += ` \x1b[90m→ ${completed}✓ ${inProgress}⟳ / ${total}\x1b[0m`;
        }
        break;
        
      case 'Task':
        if (input.description) {
          output += ` \x1b[90m→ ${input.description}\x1b[0m`;
        }
        break;
        
      case 'Glob':
        if (input.pattern) {
          output += ` \x1b[90m→ ${input.pattern}\x1b[0m`;
          if (input.path) {
            output += ` \x1b[90min ${makePathsRelative(input.path, gitRepoPath)}\x1b[0m`;
          }
        }
        break;
        
      case 'LS':
        if (input.path) {
          output += ` \x1b[90m→ ${makePathsRelative(input.path, gitRepoPath)}\x1b[0m`;
        }
        break;
        
      default:
        // MCP tools
        if (toolCall.name.startsWith('mcp_')) {
          const parts = toolCall.name.split('_').slice(1);
          if (parts.length >= 2) {
            output += ` \x1b[90m→ ${parts[0]}:${parts.slice(1).join('_')}\x1b[0m`;
          }
        }
        // Show first parameter for unknown tools
        else if (input && typeof input === 'object') {
          const keys = Object.keys(input);
          if (keys.length > 0) {
            const firstKey = keys[0];
            const value = input[firstKey];
            if (typeof value === 'string' && value.length < 50) {
              output += ` \x1b[90m→ ${value}\x1b[0m`;
            }
          }
        }
    }
  }
  
  output += '\r\n';
  
  if (isActive) {
    output += `\x1b[90m└─ ⏳ Working...\x1b[0m\r\n`;
  }
  
  return output;
}

/**
 * Format tool result in a compact way
 */
export function formatCompactToolResult(
  toolCallId: string,
  result: ToolResult,
  gitRepoPath?: string
): string {
  // Clean up active tool tracking
  activeTools.delete(toolCallId);
  
  let output = '';
  
  if (result.content) {
    const content = makePathsRelative(result.content, gitRepoPath);
    const lines = content.split('\n');
    
    // Detect errors
    const isError = content.toLowerCase().includes('error') || 
                   content.toLowerCase().includes('failed') ||
                   content.toLowerCase().includes('fatal');
    
    // Show result summary
    if (isError) {
      output += `\x1b[90m└─ \x1b[91m✗ Error\x1b[0m`;
      // Show first error line
      const errorLine = lines.find(l => 
        l.toLowerCase().includes('error') || 
        l.toLowerCase().includes('failed')
      );
      if (errorLine) {
        output += `: \x1b[91m${errorLine.trim()}\x1b[0m`;
      }
    } else if (lines[0]?.startsWith('Found')) {
      // File search results
      output += `\x1b[90m└─ ✓\x1b[0m \x1b[37m${lines[0]}\x1b[0m`;
    } else if (lines.length === 1 && lines[0].length < 100) {
      // Short single-line result
      output += `\x1b[90m└─ ✓\x1b[0m \x1b[37m${lines[0]}\x1b[0m`;
    } else {
      // Multi-line or long result - show summary
      output += `\x1b[90m└─ ✓ Complete\x1b[0m \x1b[90m[${lines.length} lines]\x1b[0m`;
    }
  } else {
    output += `\x1b[90m└─ ✓ Done\x1b[0m`;
  }
  
  output += '\r\n\r\n';
  return output;
}

/**
 * Format thinking/reasoning in a collapsible way
 */
export function formatCompactThinking(thinking: string): string {
  const timestamp = new Date().toLocaleTimeString();
  const lines = thinking.split('\n');
  const preview = lines[0].substring(0, 80) + (lines[0].length > 80 ? '...' : '');
  
  return `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[96m🧠 Thinking:\x1b[0m \x1b[90m${preview}\x1b[0m\r\n\r\n`;
}

/**
 * Enhanced JSON formatter for compact display
 */
export function formatJsonForCompactOutput(jsonMessage: any, gitRepoPath?: string): string {
  // Store pending tool calls
  if (jsonMessage.type === 'assistant' && jsonMessage.message?.content) {
    const content = jsonMessage.message.content;
    
    if (Array.isArray(content)) {
      let output = '';
      
      // Handle thinking
      const thinkingItems = content.filter((item: any) => item.type === 'thinking');
      thinkingItems.forEach((item: any) => {
        if (item.thinking) {
          output += formatCompactThinking(item.thinking);
        }
      });
      
      // Handle tool calls
      const toolUses = content.filter((item: any) => item.type === 'tool_use');
      toolUses.forEach((toolUse: ToolCall) => {
        pendingToolCalls.set(toolUse.id, {
          call: toolUse,
          timestamp: jsonMessage.timestamp || new Date().toISOString(),
          startTime: Date.now()
        });
        output += formatCompactToolCall(toolUse, true, gitRepoPath);
      });
      
      // Handle text content
      const textContent = content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n\n');
      
      if (textContent) {
        const timestamp = new Date().toLocaleTimeString();
        output += `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[35m🤖 Assistant\x1b[0m\r\n`;
        output += `\x1b[37m${textContent}\x1b[0m\r\n\r\n`;
      }
      
      return output;
    }
  }
  
  // Handle tool results
  if (jsonMessage.type === 'user' && jsonMessage.message?.content) {
    const content = jsonMessage.message.content;
    
    if (Array.isArray(content)) {
      let output = '';
      
      const toolResults = content.filter((item: any) => item.type === 'tool_result');
      toolResults.forEach((result: ToolResult) => {
        const pending = pendingToolCalls.get(result.tool_use_id);
        if (pending) {
          pendingToolCalls.delete(result.tool_use_id);
          output += formatCompactToolResult(result.tool_use_id, result, gitRepoPath);
        } else {
          // Orphaned result
          output += `\x1b[90m└─ Result [${result.tool_use_id.substring(0, 8)}...]\x1b[0m\r\n\r\n`;
        }
      });
      
      // Handle user text
      const textContent = content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join(' ');
      
      if (textContent) {
        const timestamp = new Date().toLocaleTimeString();
        output += `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[42m\x1b[30m 👤 USER \x1b[0m\r\n`;
        output += `\x1b[1m\x1b[92m${textContent}\x1b[0m\r\n`;
        output += `\x1b[90m${'─'.repeat(60)}\x1b[0m\r\n\r\n`;
      }
      
      return output;
    }
  }
  
  // Session status messages
  if (jsonMessage.type === 'session') {
    const data = jsonMessage.data || {};
    const timestamp = new Date().toLocaleTimeString();
    
    if (data.status === 'error') {
      return `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[91m❌ Error: ${data.message || 'Unknown error'}\x1b[0m\r\n\r\n`;
    }
    
    if (data.status === 'initializing') {
      return `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[33m⚡ Initializing session...\x1b[0m\r\n\r\n`;
    }
    
    return `\r\n\x1b[36m[${timestamp}]\x1b[0m \x1b[90m📝 ${data.status || 'update'}\x1b[0m\r\n`;
  }
  
  // Fallback for unknown message types
  return '';
}

// Export a function to update active tool animations
export function updateActiveToolAnimations(gitRepoPath?: string): string {
  let output = '';
  
  for (const [id, tool] of activeTools.entries()) {
    const elapsed = Math.floor((Date.now() - tool.startTime) / 1000);
    const frame = LOADING_FRAMES[tool.frame % LOADING_FRAMES.length];
    tool.frame++;
    
    // Use cursor movement to update in place
    output += `\x1b[1A\x1b[2K`; // Move up and clear line
    output += `\x1b[90m└─ ${frame} Working... \x1b[36m[${formatDuration(elapsed)}]\x1b[0m\r\n`;
  }
  
  return output;
}
import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Brain, Wrench, User, Bot, AlertCircle, CheckCircle, FileCode, Search, Edit, Terminal as TerminalIcon, ListTodo, Globe, Database } from 'lucide-react';

interface MessageFormatterProps {
  message: any;
  gitRepoPath?: string;
  isProcessing?: boolean;
  startTime?: number | null;
}

// Loading animation frames
const SMOOTH_SPINNER = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

export const MessageFormatter: React.FC<MessageFormatterProps> = ({ 
  message, 
  gitRepoPath: _gitRepoPath, 
  isProcessing = false,
  startTime = null 
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [animationFrame, setAnimationFrame] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isProcessing) {
      // Animation loop
      animationRef.current = setInterval(() => {
        setAnimationFrame(prev => (prev + 1) % SMOOTH_SPINNER.length);
      }, 80);

      // Elapsed time counter
      if (startTime) {
        const updateElapsed = () => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          setElapsedSeconds(elapsed);
        };
        updateElapsed();
        elapsedRef.current = setInterval(updateElapsed, 1000);
      }

      return () => {
        if (animationRef.current) clearInterval(animationRef.current);
        if (elapsedRef.current) clearInterval(elapsedRef.current);
      };
    }
  }, [isProcessing, startTime]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatToolCall = (toolCall: any, index: number) => {
    const isExpanded = expandedSections.has(`tool-${index}`);
    
    // Get tool icon based on name
    const getToolIcon = (name: string) => {
      if (name.toLowerCase().includes('read')) return <FileCode className="w-4 h-4" />;
      if (name.toLowerCase().includes('edit') || name.toLowerCase().includes('write')) return <Edit className="w-4 h-4" />;
      if (name.toLowerCase().includes('search') || name.toLowerCase().includes('grep') || name.toLowerCase().includes('glob')) return <Search className="w-4 h-4" />;
      if (name.toLowerCase().includes('bash') || name.toLowerCase().includes('terminal')) return <TerminalIcon className="w-4 h-4" />;
      if (name.toLowerCase().includes('todo')) return <ListTodo className="w-4 h-4" />;
      if (name.toLowerCase().includes('web')) return <Globe className="w-4 h-4" />;
      if (name.startsWith('mcp_')) return <Database className="w-4 h-4" />;
      return <Wrench className="w-4 h-4" />;
    };

    // Format compact parameters based on tool type
    const getCompactParams = (name: string, input: any) => {
      if (!input) return null;
      
      if (name === 'Read' && input.file_path) {
        return <span className="text-gray-400 ml-2">→ {input.file_path}</span>;
      }
      if ((name === 'Edit' || name === 'Write') && input.file_path) {
        return <span className="text-gray-400 ml-2">→ {input.file_path}</span>;
      }
      if ((name === 'Grep' || name === 'Search') && input.pattern) {
        return <span className="text-gray-400 ml-2">→ "{input.pattern}"</span>;
      }
      if (name === 'Bash' && input.command) {
        const cmd = input.command.length > 50 ? input.command.substring(0, 50) + '...' : input.command;
        return <span className="text-gray-400 ml-2">→ $ {cmd}</span>;
      }
      if (name === 'TodoWrite' && input.todos) {
        const completed = input.todos.filter((t: any) => t.status === 'completed').length;
        const total = input.todos.length;
        return <span className="text-gray-400 ml-2">→ {completed}/{total} tasks</span>;
      }
      if (name.startsWith('mcp_')) {
        const parts = name.split('_');
        if (parts.length >= 3) {
          return <span className="text-gray-400 ml-2">→ {parts[1]}:{parts.slice(2).join('_')}</span>;
        }
      }
      
      return null;
    };

    return (
      <div key={index} className="border border-gray-700 rounded-lg p-3 mb-2 bg-gray-800/50">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-gray-700/30 -m-1 p-1 rounded"
          onClick={() => toggleSection(`tool-${index}`)}
        >
          <div className="flex items-center gap-2 flex-1">
            {getToolIcon(toolCall.name)}
            <span className="font-medium text-yellow-400">{toolCall.name}</span>
            {!isExpanded && getCompactParams(toolCall.name, toolCall.input)}
          </div>
          <div className="flex items-center gap-2">
            {isProcessing && index === 0 && (
              <span className="text-blue-400 text-sm flex items-center gap-1">
                <span className="font-mono">{SMOOTH_SPINNER[animationFrame]}</span>
                <span>{formatDuration(elapsedSeconds)}</span>
              </span>
            )}
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
        
        {isExpanded && toolCall.input && (
          <div className="mt-2 pl-6 text-sm">
            <pre className="text-gray-300 overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const formatThinking = (thinking: string, index: number) => {
    const isExpanded = expandedSections.has(`think-${index}`);
    const preview = thinking.substring(0, 100) + (thinking.length > 100 ? '...' : '');
    
    return (
      <div key={index} className="border border-cyan-900 rounded-lg p-3 mb-2 bg-cyan-950/30">
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-cyan-900/30 -m-1 p-1 rounded"
          onClick={() => toggleSection(`think-${index}`)}
        >
          <div className="flex items-center gap-2 flex-1">
            <Brain className="w-4 h-4 text-cyan-400" />
            <span className="font-medium text-cyan-400">Thinking</span>
            {!isExpanded && <span className="text-gray-400 ml-2 text-sm">{preview}</span>}
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
        
        {isExpanded && (
          <div className="mt-2 pl-6 text-sm text-gray-300 whitespace-pre-wrap">
            {thinking}
          </div>
        )}
      </div>
    );
  };

  const formatToolResult = (result: any, index: number) => {
    const isExpanded = expandedSections.has(`result-${index}`);
    let preview = '';
    let isError = false;
    
    if (result.content) {
      const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      isError = content.toLowerCase().includes('error') || content.toLowerCase().includes('failed');
      const lines = content.split('\n');
      preview = lines[0].substring(0, 80) + (lines[0].length > 80 || lines.length > 1 ? '...' : '');
    }
    
    return (
      <div key={index} className={`border ${isError ? 'border-red-900' : 'border-green-900'} rounded-lg p-3 mb-2 ${isError ? 'bg-red-950/30' : 'bg-green-950/30'}`}>
        <div 
          className="flex items-center justify-between cursor-pointer hover:bg-gray-700/30 -m-1 p-1 rounded"
          onClick={() => toggleSection(`result-${index}`)}
        >
          <div className="flex items-center gap-2 flex-1">
            {isError ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle className="w-4 h-4 text-green-400" />}
            <span className={`font-medium ${isError ? 'text-red-400' : 'text-green-400'}`}>Result</span>
            {!isExpanded && <span className="text-gray-400 ml-2 text-sm">{preview}</span>}
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        </div>
        
        {isExpanded && result.content && (
          <div className="mt-2 pl-6 text-sm">
            <pre className="text-gray-300 overflow-x-auto whitespace-pre-wrap">
              {typeof result.content === 'string' ? result.content : JSON.stringify(result.content, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Parse message based on type
  if (message.type === 'assistant' && message.message?.content) {
    const content = message.message.content;
    
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item: any, index: number) => {
            if (item.type === 'thinking' && item.thinking) {
              return formatThinking(item.thinking, index);
            }
            if (item.type === 'tool_use') {
              return formatToolCall(item, index);
            }
            if (item.type === 'text' && item.text) {
              return (
                <div key={index} className="border border-purple-900 rounded-lg p-3 bg-purple-950/30">
                  <div className="flex items-start gap-2">
                    <Bot className="w-4 h-4 text-purple-400 mt-1" />
                    <div className="flex-1">
                      <span className="font-medium text-purple-400 block mb-1">Assistant</span>
                      <div className="text-gray-300 whitespace-pre-wrap">{item.text}</div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
  }

  if (message.type === 'user' && message.message?.content) {
    const content = message.message.content;
    
    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item: any, index: number) => {
            if (item.type === 'tool_result') {
              return formatToolResult(item, index);
            }
            if (item.type === 'text' && item.text) {
              return (
                <div key={index} className="border border-green-700 rounded-lg p-3 bg-green-950/30">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-green-400 mt-1" />
                    <div className="flex-1">
                      <span className="font-medium text-green-400 block mb-1">User</span>
                      <div className="text-gray-100 font-medium whitespace-pre-wrap">{item.text}</div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    }
  }

  // Fallback for other message types
  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800/50">
      <pre className="text-gray-300 text-sm overflow-x-auto">
        {JSON.stringify(message, null, 2)}
      </pre>
    </div>
  );
};
// Simple console wrapper to reduce logging in production
// This follows the existing pattern in the codebase

const isDevelopment = process.env.NODE_ENV !== 'production' && !(global as any).isPackaged;

// Store original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

// Helper to check if a message should be logged
function shouldLog(level: 'log' | 'info' | 'debug', args: any[]): boolean {
  if (args.length === 0) return false;
  const firstArg = args[0];
  if (typeof firstArg === 'string') {
    // Always log [Main] messages as they're important startup info
    if (firstArg.includes('[Main]')) return true;
    // Always log errors from any component
    if (firstArg.includes('Error') || firstArg.includes('Failed')) return true;
    
    // Skip verbose logging from these components in both dev and production
    if (firstArg.includes('[CommandExecutor]')) return false;
    if (firstArg.includes('[ShellPath]')) return false;
    if (firstArg.includes('[Database] Getting folders')) return false;
    if (firstArg.includes('[WorktreeManager]') && firstArg.includes('called with')) return false;
    // Skip git status polling logs
    if (firstArg.includes('[GitStatus]') && !firstArg.includes('error') && !firstArg.includes('failed')) return false;
    if (firstArg.includes('[Git]') && firstArg.includes('Refreshing git status')) return false;
    // Skip individual git status updates from frontend
    if (firstArg.includes('Git status updated:')) return false;
    if (firstArg.includes('Git status:') && firstArg.includes('→')) return false;
    // Skip verbose git status manager logs
    if (firstArg.includes('Polling git status for')) return false;
    if (firstArg.includes('Using cached status for')) return false;
    if (firstArg.includes('[IPC:git] Getting commits')) return false;
    if (firstArg.includes('[IPC:git] Project path:')) return false;
    if (firstArg.includes('[IPC:git] Using main branch:')) return false;
    
    // In development, log everything else
    if (isDevelopment) {
      return true;
    }
  }
  
  return !isDevelopment; // In production, default to not logging
}

// Override console methods
export function setupConsoleWrapper() {
  console.log = (...args: any[]) => {
    if (shouldLog('log', args)) {
      try {
        originalConsole.log(...args);
      } catch (error: any) {
        // Silently ignore EPIPE errors when console stream is closed
        if (error.code !== 'EPIPE') {
          // For non-EPIPE errors, try to at least save to a file or silently fail
          try {
            originalConsole.error('[ConsoleWrapper] Failed to write log:', error.message);
          } catch {
            // Complete silence if even error logging fails
          }
        }
      }
    }
  };
  
  console.info = (...args: any[]) => {
    if (shouldLog('info', args)) {
      try {
        originalConsole.info(...args);
      } catch (error: any) {
        // Silently ignore EPIPE errors
        if (error.code !== 'EPIPE') {
          try {
            originalConsole.error('[ConsoleWrapper] Failed to write info:', error.message);
          } catch {
            // Silent fail
          }
        }
      }
    }
  };
  
  console.debug = (...args: any[]) => {
    if (shouldLog('debug', args)) {
      try {
        originalConsole.debug(...args);
      } catch (error: any) {
        // Silently ignore EPIPE errors
        if (error.code !== 'EPIPE') {
          try {
            originalConsole.error('[ConsoleWrapper] Failed to write debug:', error.message);
          } catch {
            // Silent fail
          }
        }
      }
    }
  };
  
  // Wrap warnings and errors with try-catch as well
  console.warn = (...args: any[]) => {
    try {
      originalConsole.warn(...args);
    } catch (error: any) {
      // Silently ignore EPIPE errors for warnings
      if (error.code !== 'EPIPE') {
        // Can't log the error, just silently fail
      }
    }
  };
  
  console.error = (...args: any[]) => {
    try {
      originalConsole.error(...args);
    } catch (error: any) {
      // Even error logging can fail with EPIPE, silently ignore
    }
  };
}

// Export original console for critical logging
export { originalConsole };
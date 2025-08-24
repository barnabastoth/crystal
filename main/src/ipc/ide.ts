import { IpcMain, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import type { AppServices } from './types';

const execAsync = promisify(exec);

interface OpenFileRequest {
  sessionId?: string;
  filePath: string;
  lineNumber?: number;
}

export function registerIDEHandlers(ipcMain: IpcMain, services: AppServices): void {
  const { sessionManager } = services;

  // Open file in IDE
  ipcMain.handle('ide:openFile', async (_event, request: OpenFileRequest) => {
    try {
      let fullPath = request.filePath;
      
      // If sessionId is provided, resolve path relative to worktree
      if (request.sessionId) {
        const session = sessionManager.getSession(request.sessionId);
        if (!session) {
          throw new Error(`Session not found: ${request.sessionId}`);
        }
        
        // If the path is not absolute, make it relative to worktree
        if (!path.isAbsolute(request.filePath)) {
          fullPath = path.join(session.worktreePath, request.filePath);
        }
      }
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
      }
      
      // Try to detect VS Code first
      let vsCodeCommand: string | null = null;
      
      try {
        // Check if VS Code is available
        await execAsync('which code');
        vsCodeCommand = 'code';
      } catch {
        // VS Code not in PATH, check common locations
        const vsCodePaths = [
          '/usr/bin/code',
          '/usr/local/bin/code',
          '/opt/visual-studio-code/code',
          path.join(process.env.HOME || '', '.local/bin/code')
        ];
        
        for (const codePath of vsCodePaths) {
          if (fs.existsSync(codePath)) {
            vsCodeCommand = codePath;
            break;
          }
        }
      }
      
      if (vsCodeCommand) {
        // Open with VS Code
        let command = `"${vsCodeCommand}" "${fullPath}"`;
        
        // Add line number if provided
        if (request.lineNumber && request.lineNumber > 0) {
          command = `"${vsCodeCommand}" --goto "${fullPath}:${request.lineNumber}"`;
        }
        
        console.log(`[IDE] Opening file with VS Code: ${command}`);
        await execAsync(command);
        
        return { success: true, editor: 'VS Code' };
      } else {
        // Fallback to system default editor
        console.log(`[IDE] Opening file with system default: ${fullPath}`);
        await shell.openPath(fullPath);
        
        return { success: true, editor: 'System Default' };
      }
    } catch (error) {
      console.error('[IDE] Failed to open file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to open file' 
      };
    }
  });
  
  // Detect available IDEs
  ipcMain.handle('ide:detectIDEs', async () => {
    const availableIDEs: string[] = [];
    
    // Check for VS Code
    try {
      await execAsync('which code');
      availableIDEs.push('VS Code');
    } catch {
      // Check common VS Code paths
      const vsCodePaths = [
        '/usr/bin/code',
        '/usr/local/bin/code',
        '/opt/visual-studio-code/code',
        path.join(process.env.HOME || '', '.local/bin/code')
      ];
      
      for (const codePath of vsCodePaths) {
        if (fs.existsSync(codePath)) {
          availableIDEs.push('VS Code');
          break;
        }
      }
    }
    
    // Check for other common editors
    const editors = [
      { command: 'vim', name: 'Vim' },
      { command: 'nvim', name: 'Neovim' },
      { command: 'emacs', name: 'Emacs' },
      { command: 'subl', name: 'Sublime Text' },
      { command: 'atom', name: 'Atom' },
      { command: 'webstorm', name: 'WebStorm' },
      { command: 'idea', name: 'IntelliJ IDEA' }
    ];
    
    for (const editor of editors) {
      try {
        await execAsync(`which ${editor.command}`);
        availableIDEs.push(editor.name);
      } catch {
        // Editor not found
      }
    }
    
    return { success: true, ides: availableIDEs };
  });
}
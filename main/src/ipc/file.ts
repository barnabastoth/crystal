import { IpcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type { AppServices } from './types';
import type { Session } from '../types/session';

interface FileReadRequest {
  sessionId: string;
  filePath: string;
}

interface FileWriteRequest {
  sessionId: string;
  filePath: string;
  content: string;
}

interface FilePathRequest {
  sessionId: string;
  filePath: string;
}

interface FileListRequest {
  sessionId: string;
  path?: string;
}

interface FileDeleteRequest {
  sessionId: string;
  filePath: string;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: Date;
}

interface FileSearchRequest {
  sessionId?: string;
  projectId?: number;
  pattern: string;
  limit?: number;
}

/**
 * Calculate a relevance score for file matching with smart fuzzy and abbreviation matching
 * @param filePath - The full file path
 * @param fileName - The file name (basename)
 * @param searchPattern - Original search pattern
 * @param searchPatternLower - Lowercase version of search pattern
 * @returns Score (higher = better match, 0 = no match)
 */
function calculateFileMatchScore(filePath: string, fileName: string, searchPattern: string, searchPatternLower: string): number {
  const filePathLower = filePath.toLowerCase();
  const fileNameLower = fileName.toLowerCase();
  
  // 1. Exact match (highest priority)
  if (fileNameLower === searchPatternLower) return 1000;
  if (filePathLower === searchPatternLower) return 950;
  
  // 2. Exact prefix match
  if (fileNameLower.startsWith(searchPatternLower)) return 800;
  if (filePathLower.startsWith(searchPatternLower)) return 750;
  
  // 3. Special handling for camelCase and different naming conventions
  // Convert "httpApi" to match "http-api", "http_api", "httpapi", "httpApi", etc.
  
  // First check if the file name contains the pattern ignoring case and separators
  const normalizedPattern = searchPatternLower.replace(/[-_]/g, '');
  const normalizedFileName = fileNameLower.replace(/[-_\.]/g, '');
  
  console.log(`[DEBUG] Normalized check: pattern="${normalizedPattern}" file="${normalizedFileName}"`);
  
  if (normalizedFileName.includes(normalizedPattern)) {
    console.log(`[DEBUG] Normalized match: "${fileName}" matches pattern "${searchPattern}"`);
    return 700;
  }
  
  // Also check if it's at the start of the normalized name (higher priority)
  if (normalizedFileName.startsWith(normalizedPattern)) {
    console.log(`[DEBUG] Normalized prefix match: "${fileName}" matches pattern "${searchPattern}"`);
    return 720;
  }
  
  // 4. Fuzzy matching (characters in sequence with gaps allowed)
  const fuzzyScore = calculateFuzzyScore(fileNameLower, searchPatternLower);
  console.log(`[DEBUG] Fuzzy match: "${fileName}" vs "${searchPattern}" -> score: ${fuzzyScore}`);
  if (fuzzyScore > 0.3) return 600 + fuzzyScore * 100; // 630-700 range
  
  const fuzzyPathScore = calculateFuzzyScore(filePathLower, searchPatternLower);
  if (fuzzyPathScore > 0.3) return 500 + fuzzyPathScore * 100; // 530-600 range
  
  // 5. Abbreviation matching (first letters of words/segments)
  const abbreviationScore = calculateAbbreviationScore(fileName, searchPattern);
  console.log(`[DEBUG] Abbreviation match: "${fileName}" vs "${searchPattern}" -> score: ${abbreviationScore}`);
  if (abbreviationScore > 0.7) return 550 + abbreviationScore * 50; // 550-600 range
  
  const abbreviationPathScore = calculateAbbreviationScore(filePath, searchPattern);
  if (abbreviationPathScore > 0.7) return 500 + abbreviationPathScore * 50; // 500-550 range
  
  // 6. Very loose fuzzy matching (lower threshold)
  if (fuzzyScore > 0.1) return 400 + fuzzyScore * 50; // 400-450 range
  if (fuzzyPathScore > 0.1) return 350 + fuzzyPathScore * 50; // 350-400 range
  
  // 7. Looser abbreviation matching
  if (abbreviationScore > 0.4) return 250 + abbreviationScore * 50; // 250-300 range
  if (abbreviationPathScore > 0.4) return 200 + abbreviationPathScore * 50; // 200-250 range
  
  // 8. Substring matching (original behavior as fallback)
  if (fileNameLower.includes(searchPatternLower)) return 150;
  if (filePathLower.includes(searchPatternLower)) return 100;
  
  // 9. Word boundary matching (searching for parts of words)
  if (hasWordBoundaryMatch(fileNameLower, searchPatternLower)) return 75;
  if (hasWordBoundaryMatch(filePathLower, searchPatternLower)) return 50;
  
  return 0; // No match
}

/**
 * Calculate fuzzy matching score (characters in sequence with gaps allowed)
 * Example: "httpApi" matches "httpAp-js" because h-t-t-p-A-p-i sequence exists
 */
function calculateFuzzyScore(text: string, pattern: string): number {
  if (!pattern) return 0;
  if (text === pattern) return 1;
  
  let textIndex = 0;
  let patternIndex = 0;
  const matches: number[] = [];
  
  // Find all character matches in sequence
  while (textIndex < text.length && patternIndex < pattern.length) {
    if (text[textIndex] === pattern[patternIndex]) {
      matches.push(textIndex);
      patternIndex++;
    }
    textIndex++;
  }
  
  // If we didn't match all pattern characters, it's not a fuzzy match
  if (patternIndex < pattern.length) return 0;
  
  // Calculate score based on:
  // 1. How many characters matched (completeness)
  // 2. How close together the matches are (compactness)
  // 3. Early matches are better than late ones (position)
  
  const completeness = matches.length / pattern.length;
  const span = matches[matches.length - 1] - matches[0] + 1;
  const compactness = pattern.length / span;
  const position = 1 - (matches[0] / text.length);
  
  return completeness * 0.4 + compactness * 0.4 + position * 0.2;
}

/**
 * Calculate abbreviation matching score
 * Example: "userSubCol" matches "userSubscriptionCollection.js"
 * by matching first letters: u-ser S-ub Col-lection
 */
function calculateAbbreviationScore(text: string, pattern: string): number {
  if (!pattern) return 0;
  
  // Extract abbreviation from file name (first letters of segments)
  const textAbbrev = extractAbbreviation(text).toLowerCase();
  const patternLower = pattern.toLowerCase();
  
  if (textAbbrev === patternLower) return 1;
  if (textAbbrev.startsWith(patternLower)) return 0.9;
  
  // Check if pattern matches subsequence of abbreviation
  let textIndex = 0;
  let patternIndex = 0;
  
  while (textIndex < textAbbrev.length && patternIndex < patternLower.length) {
    if (textAbbrev[textIndex] === patternLower[patternIndex]) {
      patternIndex++;
    }
    textIndex++;
  }
  
  if (patternIndex === patternLower.length) {
    // All pattern characters found in abbreviation
    return patternLower.length / textAbbrev.length * 0.8;
  }
  
  return 0;
}

/**
 * Extract abbreviation from text by taking first letters of words/segments
 * Example: "userSubscriptionCollection.js" -> "usercjs"
 * Example: "http-api-server.ts" -> "hasts"
 */
function extractAbbreviation(text: string): string {
  // Remove file extension for abbreviation calculation
  const nameWithoutExt = text.replace(/\.[^.]*$/, '');
  
  // Split on common separators and extract first letters
  const parts = nameWithoutExt.split(/[-_\s.\/\\]/);
  let abbreviation = '';
  
  for (const part of parts) {
    if (part.length > 0) {
      // Add first letter
      abbreviation += part[0];
      
      // Add capital letters from the middle (camelCase)
      for (let i = 1; i < part.length; i++) {
        if (part[i] >= 'A' && part[i] <= 'Z') {
          abbreviation += part[i].toLowerCase();
        }
      }
    }
  }
  
  return abbreviation;
}

/**
 * Check if pattern matches at word boundaries
 * Example: "api" matches "http-api-server" at word boundary
 */
function hasWordBoundaryMatch(text: string, pattern: string): boolean {
  // Split on word boundaries and check if any part starts with pattern
  const parts = text.split(/[-_\s.\/\\]+/);
  return parts.some(part => part.startsWith(pattern));
}

export function registerFileHandlers(ipcMain: IpcMain, services: AppServices): void {
  const { sessionManager, databaseService } = services;

  // Read file contents from a session's worktree
  ipcMain.handle('file:read', async (_, request: FileReadRequest) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      // Ensure the file path is relative and safe
      const normalizedPath = path.normalize(request.filePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(session.worktreePath, normalizedPath);
      
      // Verify the file is within the worktree
      // First resolve the worktree path to handle symlinks
      const resolvedWorktreePath = await fs.realpath(session.worktreePath).catch(() => session.worktreePath);
      
      // For the file path, we need to handle the case where the file might not exist yet
      let resolvedFilePath: string;
      try {
        resolvedFilePath = await fs.realpath(fullPath);
      } catch (err) {
        // File doesn't exist, check if its directory is within the worktree
        const dirPath = path.dirname(fullPath);
        try {
          const resolvedDirPath = await fs.realpath(dirPath);
          if (!resolvedDirPath.startsWith(resolvedWorktreePath)) {
            throw new Error('File path is outside worktree');
          }
          // File doesn't exist but directory is valid
          resolvedFilePath = fullPath;
        } catch {
          // Directory doesn't exist either, just use the full path for validation
          resolvedFilePath = fullPath;
        }
      }
      
      // Check if the resolved path is within the worktree
      if (!resolvedFilePath.startsWith(resolvedWorktreePath) && !fullPath.startsWith(session.worktreePath)) {
        throw new Error('File path is outside worktree');
      }

      const content = await fs.readFile(resolvedFilePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      console.error('Error reading file:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Write file contents to a session's worktree
  ipcMain.handle('file:write', async (_, request: FileWriteRequest) => {
    try {
      // Removed verbose logging of file:write requests to reduce console noise during auto-save
      
      if (!request.filePath) {
        throw new Error('File path is required');
      }
      
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      // Note: mainBranch detection removed as it wasn't being used in this function
      // If needed in the future, use worktreeManager.detectMainBranch(session.worktreePath)

      if (!session.worktreePath) {
        throw new Error(`Session worktree path is undefined for session: ${request.sessionId}`);
      }

      // Ensure the file path is relative and safe
      const normalizedPath = path.normalize(request.filePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(session.worktreePath, normalizedPath);
      
      // Verify the file is within the worktree
      const dirPath = path.dirname(fullPath);
      
      // Try to resolve both paths to handle symlinks properly
      let resolvedDirPath = dirPath;
      let resolvedWorktreePath = session.worktreePath;
      
      try {
        // Resolve the worktree path first
        resolvedWorktreePath = await fs.realpath(session.worktreePath);
        
        // Try to resolve the directory path
        try {
          resolvedDirPath = await fs.realpath(dirPath);
        } catch (err) {
          // Directory might not exist yet, that's OK
          // Use the full path's parent that should exist
          const parentPath = path.dirname(dirPath);
          try {
            const resolvedParent = await fs.realpath(parentPath);
            resolvedDirPath = path.join(resolvedParent, path.basename(dirPath));
          } catch {
            // Even parent doesn't exist, just use the original path
            resolvedDirPath = dirPath;
          }
        }
      } catch (err) {
        console.error('Error resolving paths:', err);
        // If we can't resolve paths, just use the original ones
      }
      
      // Check if the path is within the worktree (using resolved paths)
      if (!resolvedDirPath.startsWith(resolvedWorktreePath) && !dirPath.startsWith(session.worktreePath)) {
        throw new Error('File path is outside worktree');
      }

      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });

      // Write the file
      await fs.writeFile(fullPath, request.content, 'utf-8');
      
      return { success: true };
    } catch (error) {
      console.error('Error writing file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get the full path for a file in a session's worktree
  ipcMain.handle('file:getPath', async (_, request: FilePathRequest) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      // Ensure the file path is relative and safe
      const normalizedPath = path.normalize(request.filePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(session.worktreePath, normalizedPath);
      return { success: true, path: fullPath };
    } catch (error) {
      console.error('Error getting file path:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Commit changes in a session's worktree
  ipcMain.handle('git:commit', async (_, request: { sessionId: string; message: string }) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      if (!request.message || !request.message.trim()) {
        throw new Error('Commit message is required');
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        // Stage all changes
        await execAsync('git add -A', { cwd: session.worktreePath });

        // Create the commit with Crystal signature
        const commitMessage = `${request.message}

🤖 Generated with [Crystal](https://stravu.com/?utm_source=Crystal&utm_medium=OS&utm_campaign=Crystal&utm_id=1)

Co-Authored-By: Crystal <noreply@stravu.com>`;

        // Use a here document to handle multi-line commit messages
        const command = `git commit -m "$(cat <<'EOF'
${commitMessage}
EOF
)"`;

        await execAsync(command, { cwd: session.worktreePath });

        return { success: true };
      } catch (error: any) {
        // Check if it's a pre-commit hook failure
        if (error.message?.includes('pre-commit hook')) {
          // Try to commit again in case the pre-commit hook made changes
          try {
            await execAsync('git add -A', { cwd: session.worktreePath });
            const command = `git commit -m "$(cat <<'EOF'
${request.message}

🤖 Generated with [Crystal](https://stravu.com/?utm_source=Crystal&utm_medium=OS&utm_campaign=Crystal&utm_id=1)

Co-Authored-By: Crystal <noreply@stravu.com>
EOF
)"`;
            await execAsync(command, { cwd: session.worktreePath });
            return { success: true };
          } catch (retryError: any) {
            throw new Error(`Git commit failed: ${retryError.message || retryError}`);
          }
        }
        throw new Error(`Git commit failed: ${error.message || error}`);
      }
    } catch (error) {
      console.error('Error committing changes:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Revert a specific commit
  ipcMain.handle('git:revert', async (_, request: { sessionId: string; commitHash: string }) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      if (!request.commitHash) {
        throw new Error('Commit hash is required');
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        // Create a revert commit
        const command = `git revert ${request.commitHash} --no-edit`;
        await execAsync(command, { cwd: session.worktreePath });

        return { success: true };
      } catch (error: any) {
        throw new Error(`Git revert failed: ${error.message || error}`);
      }
    } catch (error) {
      console.error('Error reverting commit:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Restore all uncommitted changes
  ipcMain.handle('git:restore', async (_, request: { sessionId: string }) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        // Reset all changes to the last commit
        await execAsync('git reset --hard HEAD', { cwd: session.worktreePath });
        
        // Clean untracked files
        await execAsync('git clean -fd', { cwd: session.worktreePath });

        return { success: true };
      } catch (error: any) {
        throw new Error(`Git restore failed: ${error.message || error}`);
      }
    } catch (error) {
      console.error('Error restoring changes:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Read file contents at a specific git revision
  ipcMain.handle('file:readAtRevision', async (_, request: { sessionId: string; filePath: string; revision?: string }) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      // Ensure the file path is relative and safe
      const normalizedPath = path.normalize(request.filePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error('Invalid file path');
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      try {
        // Default to HEAD if no revision specified
        const revision = request.revision || 'HEAD';
        
        // Use git show to get file content at specific revision
        const { stdout } = await execAsync(
          `git show ${revision}:${normalizedPath}`,
          { 
            cwd: session.worktreePath,
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          }
        );

        return { success: true, content: stdout };
      } catch (error: any) {
        // If file doesn't exist at that revision, return empty content
        if (error.message?.includes('does not exist') || error.message?.includes('bad file')) {
          return { success: true, content: '' };
        }
        throw new Error(`Failed to read file at revision: ${error.message || error}`);
      }
    } catch (error) {
      console.error('Error reading file at revision:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // List files and directories in a session's worktree
  ipcMain.handle('file:list', async (_, request: FileListRequest) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }
      
      // Check if session is archived - worktree won't exist
      if (session.archived) {
        return { success: false, error: 'Cannot list files for archived session' };
      }

      // Use the provided path or default to root
      const relativePath = request.path || '';
      
      // Ensure the path is relative and safe
      if (relativePath) {
        const normalizedPath = path.normalize(relativePath);
        if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
          throw new Error('Invalid path');
        }
      }

      const targetPath = relativePath ? path.join(session.worktreePath, relativePath) : session.worktreePath;
      
      // Read directory contents
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      
      // Process each entry
      const files: FileItem[] = await Promise.all(
        entries
          .filter(entry => entry.name !== '.git') // Exclude .git directory only
          .map(async (entry) => {
            const fullPath = path.join(targetPath, entry.name);
            const relativePath = path.relative(session.worktreePath, fullPath);
            
            try {
              const stats = await fs.stat(fullPath);
              return {
                name: entry.name,
                path: relativePath,
                isDirectory: entry.isDirectory(),
                size: entry.isFile() ? stats.size : undefined,
                modified: stats.mtime
              };
            } catch {
              // Handle broken symlinks or inaccessible files
              return {
                name: entry.name,
                path: relativePath,
                isDirectory: entry.isDirectory()
              };
            }
          })
      );

      // Sort: directories first, then alphabetically
      files.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      return { success: true, files };
    } catch (error) {
      console.error('Error listing files:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Delete a file from a session's worktree
  ipcMain.handle('file:delete', async (_, request: FileDeleteRequest) => {
    try {
      const session = sessionManager.getSession(request.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${request.sessionId}`);
      }

      // Ensure the file path is relative and safe
      const normalizedPath = path.normalize(request.filePath);
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        throw new Error('Invalid file path');
      }

      const fullPath = path.join(session.worktreePath, normalizedPath);
      
      // Verify the file is within the worktree
      // First resolve the worktree path to handle symlinks
      const resolvedWorktreePath = await fs.realpath(session.worktreePath).catch(() => session.worktreePath);
      
      // Check if the file exists and resolve its path
      let resolvedFilePath: string;
      try {
        resolvedFilePath = await fs.realpath(fullPath);
      } catch (err) {
        // File doesn't exist
        throw new Error(`File not found: ${normalizedPath}`);
      }
      
      // Check if the resolved path is within the worktree
      if (!resolvedFilePath.startsWith(resolvedWorktreePath)) {
        throw new Error('File path is outside worktree');
      }

      // Check if it's a directory or file
      const stats = await fs.stat(resolvedFilePath);
      
      if (stats.isDirectory()) {
        // For directories, use rm with recursive option
        await fs.rm(resolvedFilePath, { recursive: true, force: true });
      } else {
        // For files, use unlink
        await fs.unlink(resolvedFilePath);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Search for files matching a pattern
  ipcMain.handle('file:search', async (_, request: FileSearchRequest) => {
    try {
      // Determine the search directory
      let searchDirectory: string;
      
      if (request.sessionId) {
        const session = sessionManager.getSession(request.sessionId);
        if (!session) {
          throw new Error(`Session not found: ${request.sessionId}`);
        }
        searchDirectory = session.worktreePath;
      } else if (request.projectId) {
        const project = databaseService.getProject(request.projectId);
        if (!project) {
          throw new Error(`Project not found: ${request.projectId}`);
        }
        searchDirectory = project.path;
      } else {
        throw new Error('Either sessionId or projectId must be provided');
      }

      // Normalize the pattern for searching (remove @ prefix but keep original case)
      const searchPattern = request.pattern.replace(/^@/, '');
      const searchPatternLower = searchPattern.toLowerCase();
      
      // If the pattern contains a path separator, search from that path
      const pathParts = searchPattern.split(/[/\\]/);
      const searchDir = pathParts.length > 1 
        ? path.join(searchDirectory, ...pathParts.slice(0, -1))
        : searchDirectory;
      const filePattern = pathParts[pathParts.length - 1] || '';
      
      // Check if searchDir exists
      try {
        await fs.access(searchDir);
      } catch {
        return { success: true, files: [] };
      }

      // Get list of tracked files (not gitignored) using git
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      let gitTrackedFiles = new Set<string>();
      let isGitRepo = true;
      try {
        // Get list of all tracked files in the repository
        const { stdout: trackedStdout } = await execAsync('git ls-files', {
          cwd: searchDirectory,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        if (trackedStdout) {
          trackedStdout.split('\n').forEach((file: string) => {
            if (file.trim()) {
              gitTrackedFiles.add(file.trim());
            }
          });
        }
        
        // Also get untracked files that are not ignored
        const { stdout: untrackedStdout } = await execAsync('git ls-files --others --exclude-standard', {
          cwd: searchDirectory,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        if (untrackedStdout) {
          untrackedStdout.split('\n').forEach((file: string) => {
            if (file.trim()) {
              gitTrackedFiles.add(file.trim());
            }
          });
        }
      } catch (err) {
        // Git command failed, likely not a git repo
        isGitRepo = false;
        console.log('Could not get git tracked files:', err);
      }

      // Use glob to find ALL files, we'll filter with smart matching later
      // This ensures we don't miss files with different naming conventions
      const globPattern = '**/*';
      const files = await glob(globPattern, {
        cwd: searchDir,
        ignore: [
          '**/node_modules/**', 
          '**/.git/**', 
          '**/dist/**', 
          '**/build/**',
          '**/worktrees/**' // Exclude worktree folders
        ],
        nodir: false,
        dot: true,
        absolute: false,
        maxDepth: 5
      });

      // Convert to relative paths from the original directory
      const results = await Promise.all(
        files.map(async (file) => {
          const fullPath = path.join(searchDir, file);
          const relativePath = path.relative(searchDirectory, fullPath);
          
          // Skip worktree directories
          if (relativePath.includes('worktrees/') || relativePath.startsWith('worktrees/')) {
            return null;
          }
          
          // If we're in a git repo, only include tracked/untracked-but-not-ignored files
          if (isGitRepo && gitTrackedFiles.size > 0 && !gitTrackedFiles.has(relativePath)) {
            // Check if it's a directory - directories might not be in git ls-files
            try {
              const stats = await fs.stat(fullPath);
              if (!stats.isDirectory()) {
                return null; // Skip non-directory files that aren't tracked
              }
            } catch {
              return null;
            }
          }
          
          try {
            const stats = await fs.stat(fullPath);
            return {
              path: relativePath,
              isDirectory: stats.isDirectory(),
              name: path.basename(file)
            };
          } catch {
            return null;
          }
        })
      );

      // Pre-filter: Only process files that might match (very permissive)
      // This helps performance by not scoring every single file
      const preFiltered = results
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .filter(file => {
          if (!filePattern) return true; // If no pattern, include all
          
          // Very permissive pre-filter
          const fileNameLower = file.name.toLowerCase();
          const normalizedFileName = fileNameLower.replace(/[-_\.]/g, '');
          const normalizedPattern = searchPatternLower.replace(/[-_]/g, '');
          
          // Include file if:
          // 1. Normalized names match somehow
          // 2. First few characters match
          // 3. File contains some part of the pattern
          return normalizedFileName.includes(normalizedPattern) ||
                 normalizedPattern.includes(normalizedFileName.replace(/js$|ts$|jsx$|tsx$/, '')) ||
                 fileNameLower.startsWith(searchPatternLower.slice(0, 3)) ||
                 normalizedFileName.startsWith(normalizedPattern.slice(0, 3));
        });
      
      // Smart file matching with scoring
      const scoredResults = preFiltered
        .map(file => ({
          ...file,
          score: calculateFileMatchScore(file.path, file.name, searchPattern, searchPatternLower)
        }))
        .filter(file => file.score > 0)
        .sort((a, b) => {
          // First sort by score (higher is better)
          if (b.score !== a.score) return b.score - a.score;
          // Then sort directories first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          // Finally sort by path length (shorter paths generally more relevant)
          return a.path.length - b.path.length;
        })
        .slice(0, request.limit || 50);

      // Remove score from final results
      const filteredResults = scoredResults.map(({ score, ...file }) => file);

      return { success: true, files: filteredResults };
    } catch (error) {
      console.error('Error searching files:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        files: []
      };
    }
  });
}
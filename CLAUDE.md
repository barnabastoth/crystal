# Crystal - Multi-Session Claude Code Manager

Created by [Stravu](https://stravu.com/?utm_source=Crystal&utm_medium=OS&utm_campaign=Crystal&utm_id=1)

## 🛑 CRITICAL: UPSTREAM COMPATIBILITY - MOST IMPORTANT RULE 🛑

**THIS FORK MUST REMAIN COMPATIBLE WITH UPSTREAM UPDATES FROM stravu/crystal**

### Mandatory Non-Destructive Development Rules:

1. **NEVER MODIFY CORE LOGIC** - Add functionality through:
   - New files/components (preferred)
   - Extension hooks and event listeners
   - Configuration overrides
   - Wrapper functions that call original code

2. **MODIFICATION STRATEGY**:
   - ✅ **ADD** new files: `main/src/services/mrModFeature.ts`
   - ✅ **EXTEND** via events: Listen to existing events, emit new ones
   - ✅ **WRAP** functions: Create wrappers that call original + additions
   - ❌ **AVOID** changing existing function signatures
   - ❌ **AVOID** deleting/renaming existing code
   - ❌ **AVOID** modifying database schema (add new tables instead)

3. **FILE MODIFICATION TRACKING**:
   ```bash
   # Before making changes, check if file is from upstream:
   git log --oneline --follow path/to/file | grep upstream
   
   # Mark modified files in comments:
   // MR-MOD: Added feature X (keep upstream compatibility)
   ```

4. **SAFE MODIFICATION ZONES**:
   - `package.json` scripts (add new, don't modify existing)
   - Component styling (additive CSS classes)
   - New IPC channels (don't change existing ones)
   - New database tables (don't alter existing schema)
   - Config files (add new keys, don't change defaults)

5. **GIT WORKFLOW FOR UPSTREAM SYNC**:
   ```bash
   # Regular upstream sync process:
   git fetch upstream
   git checkout main
   git merge upstream/main  # Should merge cleanly if rules followed
   
   # If conflicts occur, document resolution:
   # MR-MOD-CONFLICT: [date] Resolved by keeping our addition + upstream change
   ```

6. **TESTING UPSTREAM COMPATIBILITY**:
   ```bash
   # Before any major change:
   git stash
   git fetch upstream
   git merge upstream/main --no-commit --no-ff
   git status  # Check for conflicts
   git merge --abort  # If conflicts, reconsider approach
   git stash pop
   ```

7. **MR-MOD NAMESPACE**:
   - Prefix custom features: `mrMod*`, `MrMod*`, `mr-mod-*`
   - Custom version tracking: `mrModVersion` (separate from upstream)
   - Custom config keys: `mrModSettings`
   - Custom components: `MrModComponent.tsx`

### Examples of Non-Destructive Additions:

**Adding a feature to Sidebar.tsx** ✅:
```typescript
// Keep original code intact
const [version, setVersion] = useState<string>('');
// MR-MOD: Add our version display
const mrModVersion = 'v0.0.1';
```

**Adding new build script** ✅:
```json
// package.json - don't modify existing scripts
"scripts": {
  "dist": "existing script",  // Don't touch
  "dist-linux": "our custom script"  // MR-MOD addition
}
```

**Adding service functionality** ✅:
```typescript
// Create new file: mrModExtensions.ts
import { originalFunction } from './original';

export function mrModEnhancedFunction() {
  const result = originalFunction();
  // Add our enhancements
  return { ...result, mrModData: 'our addition' };
}
```

### Critical Files to NEVER Modify Destructively:
- `main/src/index.ts` (core initialization)
- `main/src/database/schema.sql` (add migrations instead)
- `frontend/src/App.tsx` (use composition instead)
- Core IPC handlers (extend, don't modify)

### When Upstream Conflicts Are Unavoidable:
1. Document thoroughly with `MR-MOD-CONFLICT` comments
2. Create abstraction layer to isolate changes
3. Consider contributing feature back to upstream
4. Maintain patch file for reapplication after updates

**Remember: Every destructive change makes future upstream merges exponentially harder!**

---

## 🔴 CRITICAL: MANDATORY DOCUMENTATION UPDATE REQUIREMENT 🔴

**EVERY AI AGENT MUST DO THIS AS THEIR FINAL TASK:**

Before ending your session, you MUST:
1. **REVIEW** what you modified in the codebase
2. **EVALUATE** if your changes affect the global application architecture
3. **UPDATE** this CLAUDE.md file IF AND ONLY IF:
   - You modified critical architecture (new services, IPC handlers, database schema)
   - You changed critical workflows (session handling, state management, build process)
   - You added/removed major dependencies or features
   - You discovered critical bugs/fixes that future agents must know

**UPDATE RULES:**
- Keep additions EXTREMELY concise (1-2 lines max per change)
- Only document what's relevant for the ENTIRE application
- Update existing sections, don't create new ones
- Remove outdated information you're replacing
- Use this format: `[DATE] ComponentName: Brief description of critical change`

**DO NOT UPDATE FOR:**
- Minor bug fixes
- UI tweaks
- Refactoring that doesn't change architecture
- Feature additions that don't affect other components

**EXAMPLE UPDATE:**
```
[2024-01-15] IPC/session.ts: Added session:paused event for suspension feature
[2024-01-15] Database: Added pause_timestamp column to sessions table
```

This ensures CLAUDE.md remains the accurate source of truth for the application architecture.

## 🔴 CRITICAL BUILD INSTRUCTION 🔴

**After implementing any feature, build and install Crystal with:**
```bash
npm run dist-linux
```
This single command builds, packages, and auto-installs Crystal to `~/.local/bin/`

## 🚨 MANDATORY RULES FOR ALL AI AGENTS 🚨

1. **BUILD/TEST**: After changes, run `npm run dist-linux` to build, package & auto-install
2. **NO UNAUTHORIZED FILES**: Never create new files unless explicitly required. Never create docs (*.md) unless requested
3. **STATE MANAGEMENT**: Never modify session output handling without permission (see Critical Implementation Details)
4. **GIT WORKFLOW**: Use git worktrees. Each Claude session in own worktree. Never commit to main
5. **DEPENDENCIES**: Use `yarn` for packages (NOT npm/pnpm), except `npm run dist-linux` for building
6. **MEMORY FIX**: If heap errors: `NODE_OPTIONS="--max-old-space-size=8192" yarn install`
7. **CODE STYLE**: Follow patterns, TypeScript strict (no `any`), maintain modular architecture

## Project Structure

```
crystal/
├── frontend/                    # React 19 renderer process
│   ├── src/
│   │   ├── components/         # UI Components (75+ components)
│   │   │   ├── session/       # SessionView, SessionInput, RichOutputView, MessagesView
│   │   │   ├── ui/           # Button, Input, Modal, Card, Badge, Tooltip
│   │   │   └── dashboard/    # DraggableProjectTreeView, CombinedDiffView
│   │   ├── hooks/            # useSessionView.ts (941 lines - session logic)
│   │   ├── stores/           # Zustand state management
│   │   ├── styles/tokens/    # CSS design tokens
│   │   ├── types/            # TypeScript definitions
│   │   └── utils/            # timestampUtils.ts (critical for timestamps)
│   ├── package.json
│   └── vite.config.ts
├── main/                       # Electron main process
│   ├── src/
│   │   ├── index.ts          # Main entry (414 lines)
│   │   ├── events.ts         # Event handling (359 lines)
│   │   ├── preload.ts        # Preload script
│   │   ├── database/         # SQLite layer
│   │   │   ├── database.ts   # DB operations
│   │   │   ├── schema.sql    # Base schema
│   │   │   └── migrations/   # 20+ migration files
│   │   ├── ipc/             # IPC handlers (15+ modules)
│   │   │   ├── git.ts       # Git operations (843 lines)
│   │   │   ├── session.ts   # Session management (428 lines)
│   │   │   ├── project.ts   # Project management
│   │   │   ├── config.ts    # Configuration
│   │   │   └── [folders, dashboard, commitMode, stravu, file...]
│   │   ├── services/        # Business logic (12+ services)
│   │   │   ├── sessionManager.ts
│   │   │   ├── worktreeManager.ts
│   │   │   ├── gitStatusManager.ts
│   │   │   └── taskQueue.ts
│   │   └── utils/           # timestampUtils.ts, logger.ts
├── shared/types.ts            # Shared TypeScript interfaces
├── dist-electron/            # Build output (*.AppImage)
├── docs/                     # Documentation
└── package.json             # Root workspace config
```

## Tech Stack

**Frontend**: React 19, TypeScript, Zustand, Tailwind CSS, XTerm.js (50k buffer), Monaco Editor, Vite, react-diff-viewer-continued
**Backend**: Node.js 22+, Better-SQLite3, node-pty, Bull queue, @anthropic-ai/claude-code SDK
**Desktop**: Electron v36.4.0, electron-updater, electron-store, Linux (AppImage, .deb), macOS (universal)

## Database Schema (SQLite)

```sql
-- Projects table
projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  system_prompt TEXT,
  run_script TEXT,
  build_script TEXT,
  active BOOLEAN DEFAULT 0,
  default_permission_mode TEXT,
  commit_mode TEXT,
  display_order INTEGER
)

-- Sessions table  
sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initial_prompt TEXT NOT NULL,
  worktree_name TEXT NOT NULL,
  worktree_path TEXT NOT NULL,
  status TEXT NOT NULL, -- initializing/running/waiting/stopped/error
  project_id INTEGER,
  folder_id TEXT,
  claude_session_id TEXT,
  permission_mode TEXT,
  is_main_repo BOOLEAN,
  archived BOOLEAN DEFAULT 0,
  is_favorite BOOLEAN DEFAULT 0,
  model TEXT,
  commit_mode TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  last_viewed_at DATETIME,
  run_started_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
)

-- Session outputs
session_outputs (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL, -- stdout/stderr/json/system
  data TEXT NOT NULL,
  timestamp DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
)

-- Conversation history
conversation_messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_type TEXT, -- user/assistant
  content TEXT NOT NULL,
  timestamp DATETIME
)

-- Git diffs per execution
execution_diffs (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  execution_number INTEGER,
  diff_summary TEXT,
  files_changed TEXT,
  commit_message TEXT,
  timestamp DATETIME
)

-- Prompt navigation markers
prompt_markers (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  prompt_text TEXT,
  output_index INTEGER,
  timestamp DATETIME,
  completion_timestamp DATETIME
)
```

## API Endpoints

### Session Management
- `GET /api/sessions` - List all sessions with status
- `POST /api/sessions` - Create new session(s) with templates
- `GET /api/sessions/:id` - Get specific session details
- `DELETE /api/sessions/:id` - Archive session and cleanup worktree
- `POST /api/sessions/:id/input` - Send input to Claude Code instance
- `POST /api/sessions/:id/continue` - Continue conversation with full history
- `GET /api/sessions/:id/output` - Retrieve session output history
- `GET /api/sessions/:id/conversation` - Get conversation message history

### Project Management
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project (auto directory/git init)
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project settings
- `POST /api/projects/:id/activate` - Set active project
- `DELETE /api/projects/:id` - Delete project

### Configuration & Prompts
- `GET /api/config` - Get current application configuration
- `POST /api/config` - Update configuration settings
- `GET /api/prompts` - Get all prompts with associated sessions
- `GET /api/prompts/:sessionId/:lineNumber` - Navigate to specific prompt

## IPC Communication

### IPC Handlers (`main/src/ipc/`)
- `session.ts` (428 lines) - Session operations
- `git.ts` (843 lines) - Git operations  
- `project.ts` - Project management
- `config.ts` - Configuration
- `file.ts` - File operations
- `folders.ts` - Folder hierarchy
- `dashboard.ts` - Dashboard data
- `commitMode.ts` - Commit features
- `stravu.ts` - Stravu integration
- 15+ total handler modules

### Event System
```typescript
// Session Events
'session:created'        // New session created
'session:updated'        // Status/data changed
'session:deleted'        // Session removed
'session:output'         // Terminal output
'session:status-changed' // Status update

// Git Events
'git:status-changed'     // Working tree status
'git:diff-generated'     // Diff available
'git:commit-created'     // Commit successful

// Project Events
'project:activated'      // Active project changed
'project:updated'        // Settings modified
```

## Critical Implementation Details

### ⚠️ Session Output Handling (DO NOT MODIFY WITHOUT PERMISSION)

**Data Flow**: Database (source of truth) → On-demand transformation → Frontend display

1. **Database Storage**: Raw JSON/stdout stored as-is, no transformation at storage
2. **Real-time Streaming**: Sends formatted stdout + raw JSON for immediate feedback
3. **Session Loading**: `sessions:get-output` transforms JSON on-the-fly
4. **Frontend Display**: `useSessionView` hook with mutex lock prevents races
5. **Key Principle**: `formattedOutput` state NOT cleared on session switch

**Common Issues**:
- Duplicate messages: Sending both formatted and raw versions
- Disappearing content: Clearing output states at wrong time
- Black screens: Race conditions during session switching
- Content loads once: Improper state management

### ⚠️ Timestamp Handling

**Utilities**:
- Backend: `main/src/utils/timestampUtils.ts`
- Frontend: `frontend/src/utils/timestampUtils.ts`

**Critical Rules**:
```typescript
// ❌ WRONG - treats UTC as local
const date = new Date("2024-01-01 12:00:00");

// ✅ CORRECT - uses parseTimestamp utility
const date = parseTimestamp("2024-01-01 12:00:00");
```

**SQL Operations**:
```sql
-- Insert with UTC
INSERT INTO prompt_markers (timestamp) VALUES (datetime('now'));

-- Select with UTC marker
SELECT datetime(timestamp) || 'Z' as timestamp FROM prompt_markers;
```

### ⚠️ State Management Guidelines

**Principles**: Targeted updates > global refresh, IPC events sync state, Database = source of truth

```typescript
// ❌ BAD: Global refresh
loadProjectsWithSessions(); // Reloads everything

// ✅ GOOD: Targeted update
setProjectsWithSessions(prev => prev.map(project => 
  project.id === newSession.projectId 
    ? {...project, sessions: [...project.sessions, newSession]}
    : project
));
```

### ⚠️ Diff Viewer CSS Fix

Keep simple: `overflow: 'auto'` on wrapper, check parents for `overflow-hidden`, don't override react-diff-viewer internals

### Modular Architecture

Refactored from monolithic (2,705 lines) to modular:
- `index.ts` (414 lines): Core Electron setup
- `ipc/git.ts` (843 lines): Git IPC handlers
- `ipc/session.ts` (428 lines): Session IPC handlers
- `events.ts` (359 lines): Event coordination
- `useSessionView.ts` (941 lines): Frontend session logic

## Commands Reference

### Development
```bash
yarn install                    # Install dependencies
yarn electron-dev              # Run development mode
yarn typecheck                 # Type checking
yarn lint                      # Linting
```

### Build & Deploy
```bash
npm run dist-linux             # Build, package, and auto-install Crystal
```

### Troubleshooting
```bash
# Memory issues
NODE_OPTIONS="--max-old-space-size=8192" yarn install

# Clean build
rm -rf frontend/dist main/dist dist-electron
npm run dist-linux
```

## Features Implemented ✅

### Core Session Management
- Multi-session support with parallel Claude Code instances
- Session templates (single/multiple with numbering)
- SQLite persistence across restarts
- Session archiving instead of deletion
- Conversation continuation with full history
- Real-time status: initializing, running, waiting, stopped, error
- AI-powered session name generation

### Git Integration
- Git worktrees for isolated development
- Rebase from main, squash and rebase to main
- Diff visualization with syntax highlighting
- Commit tracking with statistics
- Uncommitted changes detection
- Command preview tooltips
- Detailed error dialogs

### User Interface
- XTerm.js terminal (50,000 line buffer)
- 4 View modes: Output, Messages, View Diff, Terminal
- Sidebar: sessions, projects, prompt history
- Real-time IPC output streaming
- Color-coded status badges
- Unread activity indicators

### Configuration
- Global: verbose logging, API key, system prompts, Claude path
- Notifications: desktop, sound (Web Audio API), custom triggers
- Project-specific: prompts, run scripts, main branch

### Performance
- Lazy loading outputs
- Debounced state updates
- Virtual terminal scrolling
- Cached git status
- Incremental session loading
- Request animation frame UI updates

## Design System

```css
/* Brand Colors */
--lilac-500: rgb(139 103 246)  /* Primary */
--lilac-600: rgb(124 79 243)   /* Hover */
--lilac-700: rgb(104 56 235)   /* Active */

/* Status Colors */
--green-500: rgb(34 197 94)    /* Success/Running */
--amber-500: rgb(245 158 11)   /* Warning/Waiting */
--red-500: rgb(239 68 68)      /* Error */
--blue-500: rgb(59 130 246)    /* Info/New activity */
```

## Debug Features

**Frontend Console Logging** (Dev only): `crystal-frontend-debug.log` captures all console output
Format: `[timestamp] [level] message (file:line)`

## Key Files Reference

- `frontend/src/components/session/SessionView.tsx` - Main session UI
- `frontend/src/hooks/useSessionView.ts` - Session view logic (941 lines)
- `main/src/services/sessionManager.ts` - Claude process management
- `main/src/services/worktreeManager.ts` - Git worktree operations
- `main/src/database/database.ts` - SQLite operations
- `main/src/ipc/git.ts` - Git IPC handlers (843 lines)
- `main/src/ipc/session.ts` - Session IPC handlers (428 lines)
- `frontend/src/utils/timestampUtils.ts` - Timestamp handling
- `main/src/utils/timestampUtils.ts` - Backend timestamps

## Security

- Electron context isolation enabled
- Preload scripts for secure IPC
- No remote content loading
- Input sanitization
- Secure API key storage
- Sandboxed git worktrees

## License & Support

MIT License | Created by [Stravu](https://stravu.com) | Not affiliated with Anthropic
Documentation: `/docs/` | Architecture: `docs/CRYSTAL_ARCHITECTURE.md` | Database: `docs/DATABASE_DOCUMENTATION.md`

---

## MR-MOD Changes Log

### Non-Destructive Modifications Made:
- **[2025-08-25] Build System**: Added `dist-linux` script and auto-install (new script, didn't modify existing)
- **[2025-08-25] Version Display**: Added `mrModVersion` to Sidebar.tsx (additive change)
- **[2025-08-25] Logger Fix**: Wrapped console methods with try-catch for EPIPE (wrapped existing, didn't replace)
- **[2025-08-25] Scripts**: Added `scripts/post-build-install.sh` (new file)

### Files Modified (with MR-MOD markers):
- `frontend/src/components/Sidebar.tsx` - Added mrModVersion display
- `main/src/utils/logger.ts` - Added EPIPE error handling
- `main/src/utils/consoleWrapper.ts` - Added EPIPE error handling
- `package.json` - Added dist-linux script (new script, preserved existing)

## 📝 FINAL REMINDER: UPDATE THIS DOCUMENT IF NEEDED

**Before ending your session:**
1. Review the changes you made
2. Verify all changes follow non-destructive principles
3. If you modified anything architecturally significant, update the relevant section
4. Add your changes to the MR-MOD Changes Log if they affect upstream compatibility
5. Keep the documentation accurate for the next AI agent
6. This is MANDATORY - failure to update critical changes makes future work harder
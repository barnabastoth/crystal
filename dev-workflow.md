# Crystal Development Workflow

## 🚀 Quick Setup for Development

Since we're running into memory issues with pnpm, here's the simplest approach:

### Method 1: Direct File Update (Fastest for small changes)

1. **Make your changes** to the source code
2. **Compile just what you changed**:
   ```bash
   # If you changed main/src/ipc/file.ts
   npx tsc main/src/ipc/file.ts --outDir main/dist --target ES2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck
   ```
3. **Update the running app**: `./update-crystal.sh`

### Method 2: Install TypeScript globally (One-time setup)

```bash
sudo pacman -S npm
npm install -g typescript electron-builder
```

Then create this simple build script:

```bash
#!/bin/bash
# compile-changes.sh

# Compile main process TypeScript files
echo "Compiling main process..."
cd main
tsc
cd ..

# If frontend changes, compile those too
if [ "$1" = "frontend" ]; then
    echo "Compiling frontend..."
    cd frontend  
    npm run build 2>/dev/null || echo "Frontend build skipped"
    cd ..
fi

# Build and install
electron-builder --linux --publish never
cp dist-electron/*.AppImage ~/.local/bin/Crystal
chmod +x ~/.local/bin/Crystal

echo "✅ Crystal updated!"
```

### Method 3: Use the existing built version

Since Crystal is already working, you can:

1. **Install TypeScript**: `yay -S typescript` 
2. **Make changes** to `main/src/ipc/file.ts`
3. **Compile**: `tsc main/src/ipc/file.ts --outDir main/dist --target ES2020 --module commonjs --esModuleInterop --skipLibCheck`
4. **Run the update script**: `./update-crystal.sh`

## 🎯 Recommended Workflow

For the smart file search you just implemented:

**Single Command Development** (WORKING ✅):
```bash
cd /home/exworm/projects/crystal && ./compile-and-run.sh
```

This command will:
1. Install TypeScript locally (if needed)
2. Compile your changes 
3. Launch Crystal with your updates
4. Works even without global TypeScript installation

**Alternative for specific files**:
```bash
cd /home/exworm/projects/crystal && ./compile-and-run.sh main/src/ipc/session.ts
```

## 📝 Available Scripts

- `./build-and-install.sh` - Full build (may run into memory issues)
- `./simple-build.sh` - Simpler build approach  
- `./update-crystal.sh` - Update existing installation with changes
- `./quick-build.sh` - Only build what changed
- `./setup-aliases.sh` - Add convenient shell aliases

## ⚡ Super Quick Method

Create this alias in your shell:

```bash
alias crystal-update='cd /home/exworm/projects/crystal && tsc main/src/ipc/file.ts --outDir main/dist --target ES2020 --module commonjs --esModuleInterop --skipLibCheck && echo "✅ Compiled" && Crystal'
```

Then just run `crystal-update` after making changes!
#!/bin/bash

# Crystal Compile and Run - Single command for development
# Usage: ./compile-and-run.sh [file-to-compile]

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[Crystal]${NC} $1"; }
print_success() { echo -e "${GREEN}[Crystal]${NC} ✅ $1"; }

FILE_TO_COMPILE=${1:-"main/src/ipc/file.ts"}

print_status "Compiling $FILE_TO_COMPILE..."

# Check if typescript is available
if command -v tsc >/dev/null 2>&1; then
    TSC_CMD="tsc"
elif [ -x "node_modules/.bin/tsc" ]; then
    TSC_CMD="node_modules/.bin/tsc"
elif [ -x "../node_modules/.bin/tsc" ]; then
    TSC_CMD="../node_modules/.bin/tsc"
else
    print_status "Installing TypeScript locally..."
    npm install typescript@latest
    TSC_CMD="node_modules/.bin/tsc"
fi

# Compile the file
if $TSC_CMD "$FILE_TO_COMPILE" --outDir main/dist --target ES2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck; then
    print_success "Compiled successfully"
    
    # Launch Crystal to test
    print_status "Launching Crystal..."
    Crystal &
    
    print_success "Crystal launched! Test your changes."
else
    echo "❌ Compilation failed"
    exit 1
fi
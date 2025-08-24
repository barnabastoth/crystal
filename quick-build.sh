#!/bin/bash

# Crystal Quick Build Script
# For faster iteration during development - only builds changed parts

set -e

# Colors for output
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[Crystal Quick]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[Crystal Quick]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[Crystal Quick]${NC} ⚠️  $1"
}

# Set memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

print_status "🚀 Quick building Crystal..."

# Check what needs rebuilding
REBUILD_FRONTEND=false
REBUILD_MAIN=false

# Check if frontend needs rebuilding
if [ ! -d "frontend/dist" ] || [ "frontend/src" -nt "frontend/dist" ]; then
    REBUILD_FRONTEND=true
    print_status "Frontend changes detected"
fi

# Check if main process needs rebuilding  
if [ ! -d "main/dist" ] || [ "main/src" -nt "main/dist" ]; then
    REBUILD_MAIN=true
    print_status "Main process changes detected"
fi

# Build only what's needed
if [ "$REBUILD_FRONTEND" = true ]; then
    print_status "Building frontend..."
    cd frontend
    pnpm run build
    cd ..
fi

if [ "$REBUILD_MAIN" = true ]; then
    print_status "Building main process..."
    cd main
    rm -rf dist
    # Try pnpm build first, fallback to manual tsc
    if ! pnpm run build 2>/dev/null; then
        print_warning "pnpm build failed, using manual compilation..."
        npx tsc || exit 1
        npm run copy:assets 2>/dev/null || true
        npm run bundle:mcp 2>/dev/null || true
    fi
    cd ..
fi

# Always rebuild electron if either part changed
if [ "$REBUILD_FRONTEND" = true ] || [ "$REBUILD_MAIN" = true ]; then
    print_status "Building Electron app..."
    node scripts/inject-build-info.js 2>/dev/null || true
    node scripts/generate-notices.js 2>/dev/null || true
    pnpm run build:electron
    
    # Install the new version
    APPIMAGE_PATH=$(find dist-electron -name "*.AppImage" -type f | head -n 1)
    if [ -n "$APPIMAGE_PATH" ] && [ -f "$APPIMAGE_PATH" ]; then
        print_status "Installing updated Crystal..."
        cp "$APPIMAGE_PATH" "$HOME/.local/bin/Crystal"
        chmod +x "$HOME/.local/bin/Crystal"
        print_success "Crystal updated successfully!"
    else
        print_warning "Could not find built AppImage"
    fi
else
    print_success "No changes detected - Crystal is up to date!"
fi

print_success "🎉 Quick build complete!"
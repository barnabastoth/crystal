#!/bin/bash

# Simple Crystal Build Script - bypasses memory issues with pnpm install

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[Crystal]${NC} $1"; }
print_success() { echo -e "${GREEN}[Crystal]${NC} ✅ $1"; }
print_warning() { echo -e "${YELLOW}[Crystal]${NC} ⚠️  $1"; }
print_error() { echo -e "${RED}[Crystal]${NC} ❌ $1"; }

export NODE_OPTIONS="--max-old-space-size=16384"

print_status "🚀 Simple Crystal build process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run from Crystal project root"
    exit 1
fi

# Skip dependency installation - assume they're already there or use existing
print_warning "Skipping dependency installation to avoid memory issues"

# Build main process manually
print_status "Building main process..."
cd main

if [ ! -d "node_modules" ]; then
    print_warning "Main node_modules missing - some features may not work"
fi

# Remove old build
rm -rf dist

# Manual TypeScript compilation
print_status "Compiling TypeScript..."
if command -v tsc >/dev/null 2>&1; then
    tsc
elif [ -x "../node_modules/.bin/tsc" ]; then
    ../node_modules/.bin/tsc
elif [ -x "node_modules/.bin/tsc" ]; then
    node_modules/.bin/tsc
else
    print_error "TypeScript compiler not found"
    exit 1
fi

# Copy assets manually if build script fails
print_status "Copying assets..."
if [ -d "assets" ]; then
    mkdir -p dist/main/assets
    cp -r assets/* dist/main/assets/ 2>/dev/null || true
fi

cd ..

# Build frontend manually
print_status "Building frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    print_warning "Frontend node_modules missing - trying to build anyway"
fi

# Remove old build
rm -rf dist

# Try vite build
if command -v vite >/dev/null 2>&1; then
    vite build
elif [ -x "../node_modules/.bin/vite" ]; then
    ../node_modules/.bin/vite build
elif [ -x "node_modules/.bin/vite" ]; then
    node_modules/.bin/vite build
else
    print_error "Vite not found - frontend build failed"
    print_warning "Continuing with main process only..."
fi

cd ..

# Manual electron-builder execution
print_status "Building Electron app..."

# Inject build info
node scripts/inject-build-info.js 2>/dev/null || print_warning "Could not inject build info"

# Generate notices  
node scripts/generate-notices.js 2>/dev/null || print_warning "Could not generate notices"

# Run electron-builder directly
if command -v electron-builder >/dev/null 2>&1; then
    electron-builder --linux --publish never
elif [ -x "node_modules/.bin/electron-builder" ]; then
    node_modules/.bin/electron-builder --linux --publish never
else
    print_error "electron-builder not found"
    exit 1
fi

# Install to local bin
print_status "Installing Crystal..."
APPIMAGE_PATH=$(find dist-electron -name "*.AppImage" -type f | head -n 1)

if [ -n "$APPIMAGE_PATH" ] && [ -f "$APPIMAGE_PATH" ]; then
    # Install paths
    INSTALL_DIR="$HOME/.local/bin"
    DESKTOP_DIR="$HOME/.local/share/applications"
    ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
    
    # Create directories
    mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"
    
    # Copy AppImage
    cp "$APPIMAGE_PATH" "$INSTALL_DIR/Crystal"
    chmod +x "$INSTALL_DIR/Crystal"
    
    # Copy icon
    if [ -f "main/assets/icon.png" ]; then
        cp "main/assets/icon.png" "$ICON_DIR/crystal.png"
    fi
    
    # Create desktop entry
    cat > "$DESKTOP_DIR/crystal.desktop" << 'EOF'
[Desktop Entry]
Name=Crystal
Comment=Claude Code Commander for managing multiple Claude Code instances
Exec=/home/exworm/.local/bin/Crystal
Icon=crystal
Type=Application
Categories=Development;IDE;
StartupWMClass=crystal
StartupNotify=true
EOF
    chmod +x "$DESKTOP_DIR/crystal.desktop"
    
    # Update desktop database
    command -v update-desktop-database >/dev/null && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    
    SIZE=$(du -h "$INSTALL_DIR/Crystal" | cut -f1)
    print_success "Crystal built and installed! ($SIZE)"
    print_success "🚀 Launch from app launcher or run: Crystal"
else
    print_error "Could not find built AppImage"
    exit 1
fi
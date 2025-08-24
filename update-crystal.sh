#!/bin/bash

# Crystal Update Script - For when you make changes and want to update the launcher
# This works by copying your changes to the existing built version

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[Crystal Update]${NC} $1"; }
print_success() { echo -e "${GREEN}[Crystal Update]${NC} ✅ $1"; }
print_warning() { echo -e "${YELLOW}[Crystal Update]${NC} ⚠️  $1"; }
print_error() { echo -e "${RED}[Crystal Update]${NC} ❌ $1"; }

print_status "🔄 Updating Crystal with your changes..."

# Check if current Crystal executable exists
if [ ! -f "$HOME/.local/bin/Crystal" ]; then
    print_error "Crystal not installed. Please download and install Crystal first."
    exit 1
fi

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
print_status "Working in: $TEMP_DIR"

# Extract the current AppImage
cd "$TEMP_DIR"
print_status "Extracting current Crystal..."
"$HOME/.local/bin/Crystal" --appimage-extract >/dev/null

if [ ! -d "squashfs-root" ]; then
    print_error "Failed to extract AppImage"
    exit 1
fi

# Find the main JavaScript file location
MAIN_JS_PATH=""
if [ -f "squashfs-root/resources/app.asar" ]; then
    print_warning "App is packaged in asar - cannot easily modify"
    print_warning "You'll need to rebuild from source or use a different approach"
    rm -rf "$TEMP_DIR"
    exit 1
elif [ -f "squashfs-root/resources/app/main/dist/main/src/index.js" ]; then
    MAIN_JS_PATH="squashfs-root/resources/app/main/dist/main/src"
else
    print_error "Cannot find main JavaScript files in extracted AppImage"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Copy your updated files
CRYSTAL_PROJECT_DIR="/home/exworm/projects/crystal"

if [ -f "$CRYSTAL_PROJECT_DIR/main/dist/main/src/ipc/file.js" ]; then
    print_status "Copying updated file.js..."
    cp "$CRYSTAL_PROJECT_DIR/main/dist/main/src/ipc/file.js" "$MAIN_JS_PATH/ipc/"
    print_success "Updated file.js"
else
    print_warning "No compiled file.js found - your changes need to be compiled first"
    print_status "Attempting to compile just the file you changed..."
    
    # Try to compile just the changed file
    cd "$CRYSTAL_PROJECT_DIR"
    
    # Install typescript locally if needed
    if ! command -v tsc >/dev/null; then
        print_status "Installing TypeScript temporarily..."
        npm install -g typescript || {
            print_error "Cannot install TypeScript"
            rm -rf "$TEMP_DIR"
            exit 1
        }
    fi
    
    # Compile the specific file
    print_status "Compiling file.ts..."
    tsc main/src/ipc/file.ts --outDir main/dist --target ES2020 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --skipLibCheck || {
        print_error "Compilation failed"
        rm -rf "$TEMP_DIR"
        exit 1
    }
    
    # Now copy the compiled file
    if [ -f "main/dist/ipc/file.js" ]; then
        cp "main/dist/ipc/file.js" "$TEMP_DIR/$MAIN_JS_PATH/ipc/"
        print_success "Compiled and copied updated file.js"
    else
        print_error "Compilation didn't produce expected output"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
fi

# Repackage the AppImage
cd "$TEMP_DIR"
print_status "Repackaging Crystal..."

# Make the AppRun executable
chmod +x squashfs-root/AppRun

# Create new AppImage
if command -v mksquashfs >/dev/null; then
    mksquashfs squashfs-root Crystal-updated.AppImage -root-owned -noappend >/dev/null
elif command -v appimagetool >/dev/null; then
    appimagetool squashfs-root Crystal-updated.AppImage >/dev/null
else
    print_error "Cannot create AppImage - mksquashfs or appimagetool not found"
    print_warning "Your changes are in: $TEMP_DIR/squashfs-root"
    print_warning "You can manually run: $TEMP_DIR/squashfs-root/AppRun"
    exit 1
fi

# Install the updated version
if [ -f "Crystal-updated.AppImage" ]; then
    print_status "Installing updated Crystal..."
    cp "Crystal-updated.AppImage" "$HOME/.local/bin/Crystal"
    chmod +x "$HOME/.local/bin/Crystal"
    print_success "Crystal updated successfully!"
else
    print_error "Failed to create updated AppImage"
    exit 1
fi

# Cleanup
rm -rf "$TEMP_DIR"

print_success "🎉 Crystal has been updated with your changes!"
print_success "🚀 Launch it from your app launcher or run: Crystal"
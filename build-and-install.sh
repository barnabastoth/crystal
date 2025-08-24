#!/bin/bash

# Crystal Build and Install Script
# This script builds Crystal and installs it for your application launcher

set -e  # Exit on any error

echo "🔧 Building Crystal..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[Crystal]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[Crystal]${NC} ✅ $1"
}

print_warning() {
    echo -e "${YELLOW}[Crystal]${NC} ⚠️  $1"
}

print_error() {
    echo -e "${RED}[Crystal]${NC} ❌ $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "main" ] || [ ! -d "frontend" ]; then
    print_error "Please run this script from the Crystal project root directory"
    exit 1
fi

# Set memory limit for Node.js
export NODE_OPTIONS="--max-old-space-size=8192"

print_status "Step 1: Installing dependencies..."
if ! pnpm install --frozen-lockfile; then
    print_warning "Frozen lockfile failed, trying without frozen lockfile..."
    pnpm install
fi

print_status "Step 2: Building frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    pnpm install
fi
pnpm run build
cd ..

print_status "Step 3: Building main process..."
cd main
if [ ! -d "node_modules" ]; then
    pnpm install
fi

# Remove old dist and build manually
rm -rf dist
if ! pnpm run build; then
    print_warning "pnpm build failed, trying manual TypeScript compilation..."
    # Try manual compilation
    if command -v npx >/dev/null 2>&1; then
        npx tsc || {
            print_error "TypeScript compilation failed"
            exit 1
        }
    else
        print_error "Cannot compile TypeScript - no tsc or npx available"
        exit 1
    fi
    
    # Copy assets if they exist
    if [ -f "package.json" ]; then
        npm run copy:assets 2>/dev/null || true
    fi
    
    # Bundle MCP if script exists
    if [ -f "package.json" ] && grep -q "bundle:mcp" package.json; then
        npm run bundle:mcp 2>/dev/null || true
    fi
fi

cd ..

print_status "Step 4: Injecting build info..."
node scripts/inject-build-info.js || print_warning "Could not inject build info"

print_status "Step 5: Generating notices..."
node scripts/generate-notices.js || print_warning "Could not generate notices"

print_status "Step 6: Building Electron application..."
if ! pnpm run build:electron; then
    print_error "Electron build failed"
    exit 1
fi

print_status "Step 7: Installing to application launcher..."

# Find the built AppImage
APPIMAGE_PATH=""
if [ -d "dist-electron" ]; then
    APPIMAGE_PATH=$(find dist-electron -name "*.AppImage" -type f | head -n 1)
fi

if [ -z "$APPIMAGE_PATH" ] || [ ! -f "$APPIMAGE_PATH" ]; then
    print_error "Could not find built AppImage in dist-electron/"
    exit 1
fi

# Install paths
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"

# Create directories if they don't exist
mkdir -p "$INSTALL_DIR"
mkdir -p "$DESKTOP_DIR"
mkdir -p "$ICON_DIR"

# Copy AppImage to local bin
print_status "Installing Crystal to $INSTALL_DIR/Crystal..."
cp "$APPIMAGE_PATH" "$INSTALL_DIR/Crystal"
chmod +x "$INSTALL_DIR/Crystal"

# Copy icon if it exists
if [ -f "main/assets/icon.png" ]; then
    print_status "Installing Crystal icon..."
    cp "main/assets/icon.png" "$ICON_DIR/crystal.png"
fi

# Create desktop entry
print_status "Creating desktop entry..."
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

# Make desktop entry executable
chmod +x "$DESKTOP_DIR/crystal.desktop"

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    print_status "Updating desktop database..."
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

print_success "Crystal built and installed successfully!"
print_success "🚀 You can now launch Crystal from your application launcher"
print_success "💡 Or run: Crystal"

# Show file sizes
if [ -f "$INSTALL_DIR/Crystal" ]; then
    SIZE=$(du -h "$INSTALL_DIR/Crystal" | cut -f1)
    print_success "📦 Crystal size: $SIZE"
fi

print_success "🎉 Done! Crystal is ready to use."

echo ""
echo "📝 Quick commands for development:"
echo "   - Make changes to code"
echo "   - Run: ./build-and-install.sh"
echo "   - Launch from app launcher or run: Crystal"
echo ""
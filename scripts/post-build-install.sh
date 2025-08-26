#!/bin/bash

# Post-build installation script for Crystal
# This script automatically installs the newly built AppImage

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist-electron"
INSTALL_DIR="$HOME/.local/bin"

# Find the latest Crystal AppImage
LATEST_APPIMAGE=$(ls -t "$DIST_DIR"/Crystal-*-linux-x86_64.AppImage 2>/dev/null | head -1)

if [ -z "$LATEST_APPIMAGE" ]; then
    echo "❌ Error: No Crystal AppImage found in $DIST_DIR"
    exit 1
fi

# Extract version from filename
VERSION=$(basename "$LATEST_APPIMAGE" | sed -n 's/Crystal-\(.*\)-linux-x86_64.AppImage/\1/p')
echo "📦 Found Crystal version $VERSION"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Install the AppImage
INSTALL_PATH="$INSTALL_DIR/Crystal.AppImage"
echo "📥 Installing Crystal to $INSTALL_PATH..."
cp "$LATEST_APPIMAGE" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

# Update or create the launcher script to use the installed AppImage
LAUNCHER_PATH="$INSTALL_DIR/Crystal"
cat > "$LAUNCHER_PATH" << 'EOF'
#!/bin/bash
# Crystal launcher - launches the installed AppImage
APPIMAGE="$HOME/.local/bin/Crystal.AppImage"

if [ ! -f "$APPIMAGE" ]; then
    echo "Error: Crystal is not installed at $APPIMAGE"
    echo "Please run 'npm run dist-linux' to build and install Crystal"
    exit 1
fi

exec "$APPIMAGE" "$@"
EOF

chmod +x "$LAUNCHER_PATH"

# Clean up old versions in dist-electron (keep only the 3 most recent)
echo "🧹 Cleaning up old builds..."
ls -t "$DIST_DIR"/Crystal-*-linux-x86_64.AppImage 2>/dev/null | tail -n +4 | xargs -r rm -f
ls -t "$DIST_DIR"/Crystal-*-linux-amd64.deb 2>/dev/null | tail -n +4 | xargs -r rm -f

echo "✅ Crystal $VERSION installed successfully!"
echo "🚀 You can now run Crystal with: Crystal"
echo ""
echo "The following files have been installed:"
echo "  - AppImage: $INSTALL_PATH"
echo "  - Launcher: $LAUNCHER_PATH"
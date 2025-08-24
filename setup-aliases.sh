#!/bin/bash

# Setup convenient aliases for Crystal development

CRYSTAL_DIR=$(pwd)
SHELL_RC=""

# Detect shell and RC file
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    echo "⚠️  Could not detect shell type. Please add aliases manually."
    exit 1
fi

echo "🔧 Setting up Crystal development aliases..."

# Create aliases
ALIASES="
# Crystal Development Aliases
alias crystal-build='cd $CRYSTAL_DIR && ./build-and-install.sh'
alias crystal-quick='cd $CRYSTAL_DIR && ./quick-build.sh'
alias crystal-dev='cd $CRYSTAL_DIR'
alias crystal-run='Crystal'
"

# Check if aliases already exist
if grep -q "Crystal Development Aliases" "$SHELL_RC" 2>/dev/null; then
    echo "✅ Crystal aliases already exist in $SHELL_RC"
else
    echo "$ALIASES" >> "$SHELL_RC"
    echo "✅ Added Crystal aliases to $SHELL_RC"
fi

echo ""
echo "🎉 Setup complete! Available commands:"
echo "   crystal-build  - Full build and install"
echo "   crystal-quick  - Quick build (only changed parts)"
echo "   crystal-dev    - Navigate to Crystal project"
echo "   crystal-run    - Launch Crystal"
echo ""
echo "💡 Reload your shell or run: source $SHELL_RC"
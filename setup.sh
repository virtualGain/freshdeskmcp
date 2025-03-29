#!/bin/bash

# Exit on error
set -e

echo "Setting up Freshdesk MCP Server..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "Creating .env file..."
  cp .env.example .env
  echo "Please edit the .env file to add your Freshdesk API key and domain."
fi

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

echo "Setup complete!"
echo "To start the server, run: npm start"
echo "To use with Claude Desktop, add the configuration from README.md to your claude_desktop_config.json file."
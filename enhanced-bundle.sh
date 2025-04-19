#!/bin/bash

# Enhanced bundle script for EntraAware MCP Server

# Make sure we start with a clean slate
rm -rf bundle-dist
mkdir -p bundle-dist

# Build the TypeScript code
echo "Building TypeScript..."
npm run build

# Install esbuild if not already installed
if ! command -v npx esbuild &> /dev/null; then
  echo "Installing esbuild..."
  npm install --save-dev esbuild
fi

# Create a bundled version using esbuild
echo "Creating bundle with esbuild..."
npx esbuild build/index.js \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile=bundle-dist/entraaware-bundle.mjs \
  --external:node:* \
  --minify

# Create a launcher script for the bundled version
echo "Creating launcher script..."
cat > bundle-dist/run-bundled-server.js << 'EOF'
#!/usr/bin/env node

/**
 * EntraAware MCP Server - Bundled Launcher
 * This script launches the bundled version of EntraAware,
 * which contains all dependencies and doesn't require npm.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Get the directory where this script is located
const scriptDir = __dirname;

// Path to the bundled server file
const bundlePath = path.join(scriptDir, 'entraaware-bundle.mjs');

// Check if the bundle exists
if (!fs.existsSync(bundlePath)) {
  console.error(`Error: Bundle file not found at: ${bundlePath}`);
  process.exit(1);
}

// Set NODE_OPTIONS for ES modules
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-specifier-resolution=node';

console.error("Starting EntraAware MCP Server (bundled version)...");

// Launch the server bundle with Node
const serverProcess = spawn(process.execPath, [bundlePath], {
  stdio: 'inherit', 
  env: process.env
});

// Handle termination
serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});

// Forward signals to the child process
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    serverProcess.kill(signal);
  });
});
EOF

# Create a static bin script that directly includes the bundle
echo "Creating static bin script..."
cat > bin/static-runner.js << 'EOF'
#!/usr/bin/env node

/**
 * EntraAware Static Runner
 * This script is the entry point when installed via npm/npx.
 * It contains the bundled server inline to avoid dependency issues.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Create a temporary directory for our bundled server
const tempDir = path.join(os.tmpdir(), 'entraaware-' + Math.random().toString(36).substring(7));
fs.mkdirSync(tempDir, { recursive: true });

console.error('Starting EntraAware MCP Server...');

// Write the bundled server to a temporary file
// The BUNDLE_CONTENT placeholder will be replaced with the actual bundle
const bundlePath = path.join(tempDir, 'server-bundle.mjs');

// Copy the bundle from the package
const bundleSourcePath = path.join(__dirname, '..', 'bundle-dist', 'entraaware-bundle.mjs');

if (fs.existsSync(bundleSourcePath)) {
  // Copy the bundle file if it exists in the package
  fs.copyFileSync(bundleSourcePath, bundlePath);
} else {
  console.error(`Bundle file not found at: ${bundleSourcePath}`);
  process.exit(1);
}

// Set NODE_OPTIONS for ES modules
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-specifier-resolution=node';

// Run the server bundle
const nodeProcess = spawn(process.execPath, [bundlePath], {
  stdio: 'inherit',
  env: process.env
});

// Handle cleanup when the server exits
nodeProcess.on('exit', (code) => {
  // Clean up the temporary directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
  
  process.exit(code || 0);
});

// Forward signals
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    nodeProcess.kill(signal);
  });
});
EOF

# Make scripts executable
chmod +x bundle-dist/run-bundled-server.js
chmod +x bin/static-runner.js

echo "Bundle created successfully!"
echo "You can run the bundled server directly with: node bundle-dist/run-bundled-server.js"
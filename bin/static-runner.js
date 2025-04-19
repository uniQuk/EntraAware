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

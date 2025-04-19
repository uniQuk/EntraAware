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

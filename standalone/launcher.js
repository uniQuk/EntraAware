#!/usr/bin/env node

/**
 * EntraAware MCP Server - Standalone Launcher
 * 
 * This script launches the EntraAware MCP server without requiring npm/npx at runtime.
 * It automatically installs dependencies once (if needed) using the public npm registry,
 * then launches the server directly.
 */

const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to marker file to indicate dependencies are installed
const DEPS_INSTALLED_MARKER = path.join(__dirname, '.deps-installed');
const NODE_MODULES_PATH = path.join(__dirname, '..', 'node_modules');

// Check if dependencies are installed
const depsInstalled = fs.existsSync(DEPS_INSTALLED_MARKER) && fs.existsSync(NODE_MODULES_PATH);

// Install dependencies if needed
if (!depsInstalled) {
  console.error('Installing dependencies (one-time setup)...');
  
  try {
    const npmResult = spawnSync('npm', ['install', '--no-save'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: { 
        ...process.env,
        // Force use of public npm registry for dependencies
        npm_config_registry: 'https://registry.npmjs.org/'
      }
    });
    
    if (npmResult.status !== 0) {
      console.error('Failed to install dependencies.');
      process.exit(1);
    }
    
    // Create marker file
    fs.writeFileSync(DEPS_INSTALLED_MARKER, new Date().toISOString());
    console.error('Dependencies installed successfully.');
  } catch (error) {
    console.error('Error installing dependencies:', error.message);
    process.exit(1);
  }
}

// Run the MCP server using Node directly
console.error('Starting EntraAware MCP Server...');

// Set NODE_OPTIONS for ES modules
process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-specifier-resolution=node';

// Load the server module using dynamic import
const serverPath = path.join(__dirname, '..', 'build', 'index.js');

// Launch the server as a child process to ensure proper ES module loading
const serverProcess = spawn(process.execPath, [serverPath], {
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
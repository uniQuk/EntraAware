#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const bundlePath = resolve(__dirname, 'entraaware-bundle.mjs');

// Pass through environment variables for Entra authentication
process.env.NODE_OPTIONS = '--experimental-specifier-resolution=node';

// Run the bundled server
try {
  console.error('Starting EntraAware MCP Server...');
  import(bundlePath);
} catch (err) {
  console.error('Failed to start EntraAware:', err);
  process.exit(1);
}

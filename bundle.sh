#!/bin/bash

# Build the TypeScript code
echo "Building TypeScript..."
npm run build

# Create a bundled version using esbuild
echo "Creating bundle with esbuild..."
npx esbuild build/index.js \
  --bundle \
  --platform=node \
  --format=esm \
  --outfile=dist/entraaware-bundle.mjs \
  --external:node:* \
  --minify

# Make the bundle executable
chmod +x dist/entraaware-bundle.mjs

# Create a launcher script
echo "Creating launcher script..."
mkdir -p dist
cat > dist/entraaware-launcher.mjs << 'EOF'
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
EOF

chmod +x dist/entraaware-launcher.mjs

echo "Bundle created successfully at dist/entraaware-bundle.mjs"
echo "Launcher created successfully at dist/entraaware-launcher.mjs"
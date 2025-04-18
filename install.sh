#!/bin/bash

# This script sets up the proper npm registry configuration for EntraAware

# Create a temporary .npmrc that points to both registries
cat > /tmp/entraaware-npmrc << EOF
# Use GitHub Packages for @uniquk scope, public npm for everything else
@uniquk:registry=https://npm.pkg.github.com/
registry=https://registry.npmjs.org/
EOF

# Create a script to run npx with the custom .npmrc
cat > /tmp/run-entraaware.sh << EOF
#!/bin/bash

# Environment variables for Entra authentication
export TENANT_ID="\${TENANT_ID:-}"
export CLIENT_ID="\${CLIENT_ID:-}"
export CLIENT_SECRET="\${CLIENT_SECRET:-}"
export NODE_OPTIONS="--experimental-specifier-resolution=node"

# Run npx with our custom npmrc
NPM_CONFIG_USERCONFIG=/tmp/entraaware-npmrc npx -y @uniquk/entraaware

# Clean up
rm -f /tmp/entraaware-npmrc
EOF

chmod +x /tmp/run-entraaware.sh

echo "EntraAware configuration complete!"
echo "Run the server with: /tmp/run-entraaware.sh"

# Run immediately if requested
if [[ "$1" == "--run" ]]; then
  /tmp/run-entraaware.sh
fi
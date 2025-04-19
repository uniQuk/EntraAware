# EntraAware MCP Server

EntraAware is an MCP server designed to connect to Microsoft 365 Entra (Azure AD) and expose tools for retrieving data from your Entra tenant. It is installable via npx and can be configured in VS Code or Claude for Desktop as an MCP server.

## Features
- Connects to Microsoft 365 Entra (Azure AD) using environment variables: `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`.
- Exposes tools for retrieving data from your Entra tenant (e.g., user info, groups, etc.).
- Ready for use in GitHub Copilot and Claude for Desktop via MCP protocol.

## Installation & Running

### Method 1: Running the bundled server (recommended)
The bundled version includes all dependencies and doesn't require npm at runtime:

```bash
# Clone the repository
git clone https://github.com/uniquk/entraaware.git
cd entraaware

# Build the bundle (only needs to be done once)
npm install
./bundle.sh

# Run the server
node dist/entraaware-launcher.mjs
```

### Method 2: Using npx with GitHub Packages
```bash
# Run directly with npx (requires proper npm config for GitHub Packages)
npx --registry=https://npm.pkg.github.com @uniquk/entraaware
```

## VS Code Configuration
Add to your VS Code `settings.json`:

```json
"mcp": {
  "servers": {
    "EntraAware": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/entraaware/dist/entraaware-launcher.mjs"
      ],
      "env": {
        "TENANT_ID": "<your-tenant-id>",
        "CLIENT_ID": "<your-client-id>",
        "CLIENT_SECRET": "<your-client-secret>",
        "NODE_OPTIONS": "--experimental-specifier-resolution=node"
      }
    }
  }
}
```

## Available MCP Tools

EntraAware exposes the following tools through the MCP protocol:

1. `get-entra-user` - Get user information by UPN (email)
   - Parameter: `upn` - User Principal Name

2. `list-entra-users` - List users from Entra with optional filter
   - Parameter: `filter` (optional) - OData filter expression

3. `get-user-groups` - Get groups that a user is a member of
   - Parameter: `upn` - User Principal Name

4. `get-organization` - Get details about the organization
   - No parameters required

## Development
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build bundled version
npm run bundle 

# Run the server
npm start
```

## Publishing
To publish updates to GitHub Packages:
```bash
npm publish
```
This will automatically build the bundle before publishing.

## References
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/llms-full.txt)
- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/overview)

---

> This project was bootstrapped using the MCP server template for TypeScript.

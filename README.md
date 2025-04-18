# EntraAware MCP Server

EntraAware is an MCP server designed to connect to Microsoft 365 Entra (Azure AD) and expose tools for retrieving data from your Entra tenant. It is installable via npx and can be configured in VS Code or Claude for Desktop as an MCP server.

## Features
- Connects to Microsoft 365 Entra (Azure AD) using environment variables: `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`.
- Exposes tools for retrieving data from your Entra tenant (e.g., user info, groups, etc.).
- Ready for use in GitHub Copilot and Claude for Desktop via MCP protocol.

## Installation

### Option 1: Using the installation script (recommended)
```bash
# Clone the repository
git clone https://github.com/uniquk/entraaware.git
cd entraaware

# Run the installation script (handles registry configuration automatically)
./install.sh
```

### Option 2: Manual installation with mixed registries
```bash
# Install from GitHub Packages but fetch dependencies from public npm registry
npm install --registry=https://registry.npmjs.org/ --scope=@uniquk --registry=https://npm.pkg.github.com/ @uniquk/entraaware
```

## Usage

### Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Run the server:
   ```bash
   npm start
   ```

### Using with npx
After installation, run the server:
```bash
npx entraaware
```

### MCP Server Configuration Example
Add to your VS Code `settings.json` or Claude for Desktop config:
```json
"mcp": {
  "servers": {
    "EntraAware": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "entraaware"
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
- Main entry: `src/index.ts`
- Build output: `build/index.js`
- Binary entry: `bin/entraaware.js`
- MCP config: `.github/mcp.json`

## Publishing
To publish updates to GitHub Packages:
```bash
npm run publish-github
```

## References
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/llms-full.txt)
- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/overview)

---

> This project was bootstrapped using the MCP server template for TypeScript.

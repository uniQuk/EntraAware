# EntraAware MCP Server

EntraAware is an MCP server designed to connect to Microsoft 365 Entra (Azure AD) and expose tools for retrieving data from your Entra tenant. It is installable via npx and can be configured in VS Code or Claude for Desktop as an MCP server.

## Features
- Connects to Microsoft 365 Entra (Azure AD) using environment variables: `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`.
- Exposes tools for retrieving data from your Entra tenant (e.g., user info, groups, etc.).
- Ready for use in GitHub Copilot and Claude for Desktop via MCP protocol.

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
To run the server directly with npx:
```bash
npx @uniquk/entraaware
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
        "-y",
        "@uniquk/entraaware@latest"
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

## Development
- Main entry: `src/index.ts`
- Build output: `build/index.js`
- Binary entry: `bin/entraaware.js`
- MCP config: `.github/mcp.json`

## References
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/llms-full.txt)

---

> This project was bootstrapped using the MCP server template for TypeScript.

# EntraAware MCP Server

A simple, lightweight Model Context Protocol (MCP) server for querying Microsoft Entra (Azure AD) data.

## What is EntraAware?

EntraAware is an MCP Server allows AI assistants to directly access your Microsoft Entra (Azure AD) tenant data through the Microsoft Graph API. With EntraAware, you can ask natural language questions about your Entra environment.

## Setup

### Prerequisites

- Microsoft Entra (Azure AD) tenant
- Application registration with appropriate Graph API permissions
- Node.js 18 or higher

### Installation

```bash
# Install globally
npm install -g @uniquk/entraaware

# Or use with npx (no installation needed)
npx @uniquk/entraaware
```

### Configuration

Create a `.mcp.json` file in your VS Code workspace:

```json
{
  "servers": {
    "EntraAware": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@uniquk/entraaware@latest"
      ],
      "env": {
        "TENANT_ID": "your-tenant-id",
        "CLIENT_ID": "your-client-id",
        "CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Replace the environment variables with your own:

- `TENANT_ID` - Your Microsoft Entra tenant ID
- `CLIENT_ID` - Your Microsoft Entra client ID/application ID
- `CLIENT_SECRET` - Your Microsoft Entra client secret

## Usage

Once configured, you can use EntraAware through VS Code by typing:

```
ask EntraAware>
```

The EntraAware MCP tool provides a single function that automatically detects the right Graph API endpoint based on keywords in your question:

```json
{
  "question": "Show me all conditional access policies"
}
```

### Example Queries

```
// Get organization details
Show me details about my organization

// Get conditional access policies
List all conditional access policies

// Get information about a specific user
Find user john.doe@example.com

// Get all groups
Show me all groups
```

## References

- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/overview)
- [EntraAware npm package](https://www.npmjs.com/package/@uniquk/entraaware)

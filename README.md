# EntraAware MCP Server

A lightweight Model Context Protocol (MCP) server for querying Microsoft Entra (Azure AD) and Azure Resource Management data.

## What is EntraAware?

EntraAware is an MCP Server that allows AI assistants to directly access your Microsoft Entra (Azure AD) tenant data through the Microsoft Graph API and Azure Resource Management API. With EntraAware, you can ask natural language questions or make structured API calls to your Microsoft cloud environments.

This project is inspired by and builds upon the [Lokka-Microsoft](https://github.com/lokkamcp/microsoft) MCP server (MIT license).

## Setup

### Prerequisites

- Microsoft Entra (Azure AD) tenant
- Application registration with appropriate Graph API permissions and Azure Resource Management permissions
- Node.js 18 or higher

### Installation

```bash
# Install globally
npm install -g @north7/entraaware

# Or use with npx (no installation needed)
npx @north7/entraaware
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
        "@north7/entraaware@latest"
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

Once configured, you can use EntraAware through a compatible MCP client (like VS Code with the MCP extension).

### Available Tools

EntraAware provides three MCP tools:

#### 1. askEntra

Direct access to Microsoft Graph API for accurate Entra (Azure AD) data.

```javascript
// Example usage
{
  "path": "/users", 
  "method": "get",
  "select": "displayName,userPrincipalName,id",
  "top": 10
}

// Advanced filtering
{
  "path": "/users",
  "method": "get",
  "filter": "startsWith(displayName,'J')",
  "consistencyLevel": "eventual"
}
```

#### 2. askAzure

Direct access to Azure Resource Management API for managing Azure resources.

```javascript
// List subscriptions
{
  "path": "/subscriptions",
  "method": "get"
}

// List all resource groups in a subscription
{
  "path": "/resourceGroups",
  "method": "get",
  "subscriptionId": "your-subscription-id",
  "apiVersion": "2021-04-01"
}

// Use predefined operations
{
  "operation": "listResources",
  "subscriptionId": "your-subscription-id"
}
```

#### 3. Lokka-Microsoft (Compatibility Layer)

A compatibility layer for the Lokka-Microsoft MCP server to ensure backward compatibility.

```javascript
// Query Graph API
{
  "apiType": "graph",
  "path": "/users",
  "method": "get"
}

// Query Azure API
{
  "apiType": "azure",
  "path": "/subscriptions",
  "method": "get",
  "apiVersion": "2022-12-01"
}
```

## License

MIT License - See LICENSE file for details.

## Acknowledgements

- This project is inspired by and builds upon the [Lokka-Microsoft](https://github.com/merill/lokka) MCP server.
- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/api/overview)
- [Azure Resource Management API Documentation](https://learn.microsoft.com/en-us/rest/api/azure/)

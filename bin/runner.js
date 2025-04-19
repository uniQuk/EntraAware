#!/usr/bin/env node

/**
 * This is a runner script that allows EntraAware to be executed from npm/npx
 * while properly handling both GitHub Packages and public npm registry dependencies.
 * This script is called when users run npx @uniquk/entraaware
 */

// Use CommonJS to ensure compatibility
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Create a temp directory for our runtime configs
const tempDir = path.join(os.tmpdir(), 'entraaware-' + Math.random().toString(36).substring(2, 15));
fs.mkdirSync(tempDir, { recursive: true });

// Create a temporary .npmrc file that handles both registries
const npmrcPath = path.join(tempDir, '.npmrc');
fs.writeFileSync(npmrcPath, `
# Use GitHub Packages for @uniquk scope, public npm for everything else
@uniquk:registry=https://npm.pkg.github.com/
registry=https://registry.npmjs.org/
`);

try {
  console.log('Installing EntraAware dependencies...');
  
  // Install dependencies using the custom npmrc
  execSync(`npm install --no-save @azure/identity @microsoft/microsoft-graph-client @modelcontextprotocol/sdk zod`, {
    cwd: tempDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_userconfig: npmrcPath
    }
  });
  
  // Create a temporary server runner script
  const runnerPath = path.join(tempDir, 'run-server.mjs');
  fs.writeFileSync(runnerPath, `
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";

const server = new McpServer({
  name: "EntraAware",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper to get an authenticated Microsoft Graph client
function getGraphClient() {
  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing required Entra environment variables.");
  }
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        return token?.token || "";
      },
    },
  });
}

// Get Entra user by UPN (email)
server.tool(
  "get-entra-user",
  "Get user info from Microsoft Entra by UPN",
  {
    upn: z.string().describe("User Principal Name (email)")
  },
  async ({ upn }) => {
    try {
      const client = getGraphClient();
      const user = await client.api(\`/users/\${upn}\`).get();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: \`Error: \${err instanceof Error ? err.message : String(err)}\`,
          },
        ],
      };
    }
  }
);

// Get all users in the tenant with optional filter
server.tool(
  "list-entra-users",
  "List users from Microsoft Entra with optional filter",
  {
    filter: z.string().optional().describe("OData filter expression (e.g. startsWith(displayName,'John'))")
  },
  async ({ filter }) => {
    try {
      const client = getGraphClient();
      let request = client.api('/users');
      
      if (filter) {
        request = request.filter(filter);
      }
      
      const users = await request.select('id,displayName,userPrincipalName,jobTitle,department').top(25).get();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(users, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: \`Error: \${err instanceof Error ? err.message : String(err)}\`,
          },
        ],
      };
    }
  }
);

// Get groups for a user
server.tool(
  "get-user-groups",
  "Get groups that a user is a member of",
  {
    upn: z.string().describe("User Principal Name (email)")
  },
  async ({ upn }) => {
    try {
      const client = getGraphClient();
      const groups = await client.api(\`/users/\${upn}/memberOf\`).get();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(groups, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: \`Error: \${err instanceof Error ? err.message : String(err)}\`,
          },
        ],
      };
    }
  }
);

// Get organization details
server.tool(
  "get-organization",
  "Get details about the organization",
  {},
  async () => {
    try {
      const client = getGraphClient();
      const org = await client.api('/organization').get();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(org, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: \`Error: \${err instanceof Error ? err.message : String(err)}\`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("EntraAware MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
  `);
  
  // Run the server
  console.log('Starting EntraAware MCP Server...');
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--experimental-specifier-resolution=node';
  
  // Change directory to temp dir where deps are installed
  process.chdir(tempDir);
  
  // Use dynamic import to run the server
  import('node:child_process').then(({ spawn }) => {
    const server = spawn('node', [runnerPath], {
      stdio: 'inherit',
      env: process.env
    });
    
    // Handle exit
    server.on('exit', (code) => {
      // Clean up temp dir
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
      process.exit(code || 0);
    });
    
    // Forward signals
    ['SIGINT', 'SIGTERM'].forEach(signal => {
      process.on(signal, () => {
        server.kill(signal);
      });
    });
  });
} catch (error) {
  console.error('Error running EntraAware:', error);
  
  // Clean up temp dir on error
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
  
  process.exit(1);
}
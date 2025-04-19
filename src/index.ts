#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

// Initialize Graph Client
let graphClient: Client | null = null;

// Create server instance
const server = new McpServer({
  name: "EntraAware",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Direct Microsoft Graph API access tool
server.tool(
  "askEntra",
  "Ask any question about your Microsoft Entra (Azure AD) tenant in natural language",
  {
    question: z.string().describe("Your natural language question about Microsoft 365 Entra (Azure AD)")
  },
  async ({ question }) => {
    try {
      // Get or initialize Graph client
      if (!graphClient) {
        graphClient = initGraphClient();
      }

      // Default path if we can't determine from the question
      let path = "/organization";
      
      // Extract any email addresses or GUIDs from the question
      const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      const guidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
      
      const emailMatch = question.match(emailPattern);
      const guidMatch = question.match(guidPattern);
      
      // Check for specific keywords in the question to determine the right path
      const lowerQuestion = question.toLowerCase();
      
      if (lowerQuestion.includes("conditional access") || lowerQuestion.includes("policies")) {
        path = "/identity/conditionalAccess/policies";
      } else if (lowerQuestion.includes("users") || lowerQuestion.includes("user")) {
        path = "/users";
        if (emailMatch) {
          path = `/users/${emailMatch[0]}`;
        }
      } else if (lowerQuestion.includes("groups") || lowerQuestion.includes("group")) {
        path = "/groups";
      } else if (lowerQuestion.includes("applications") || lowerQuestion.includes("apps")) {
        path = "/applications";
      } else if (lowerQuestion.includes("roles") || lowerQuestion.includes("directory roles")) {
        path = "/directoryRoles";
      }
      
      // If a GUID was found and not already used in the path, append it
      if (guidMatch && !path.includes(guidMatch[0])) {
        path = `${path}/${guidMatch[0]}`;
      }
      
      // Build and execute the request
      let request = graphClient.api(path);
      
      // Execute the request
      const result = await request.get();
      
      // Format the response
      return {
        content: [
          {
            type: "text",
            text: `📊 Entra API Result (${path}):\n\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error querying Entra API: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }
);

// Helper function to initialize the Microsoft Graph client
function initGraphClient(): Client {
  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing required Entra environment variables: TENANT_ID, CLIENT_ID, or CLIENT_SECRET");
  }
  
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });
  
  return Client.initWithMiddleware({
    authProvider: authProvider,
  });
}

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("EntraAware MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
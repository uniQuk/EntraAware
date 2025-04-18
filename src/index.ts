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

// Replace the placeholder tool with a real Graph API call
server.tool(
  "get-entra-user",
  "Get user info from Microsoft Entra by UPN",
  {
    upn: z.string().describe("User Principal Name (email)")
  },
  async ({ upn }) => {
    try {
      const client = getGraphClient();
      const user = await client.api(`/users/${upn}`).get();
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
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
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
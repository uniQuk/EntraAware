#!/usr/bin/env node
/**
 * EntraAware MCP Server
 * 
 * Portions of this code are adapted from the Lokka-Microsoft MCP Server (MIT License)
 * Original repository: https://github.com/merill/lokka
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential, DefaultAzureCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

// Initialize clients
let graphClient: Client | null = null;
let azureCredential: DefaultAzureCredential | ClientSecretCredential | null = null;

// Create server instance
const server = new McpServer({
  name: "EntraAware",
  version: "0.0.6",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// SHARED UTILITIES
// The following credential handling utilities are adapted from Lokka-Microsoft
function getCredentials(): { tenantId: string; clientId: string; clientSecret: string } {
  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing required environment variables: TENANT_ID, CLIENT_ID, or CLIENT_SECRET");
  }
  
  return { tenantId, clientId, clientSecret };
}

// Helper to fetch the latest API version for a given resource provider and resource type
async function getLatestApiVersion(
  providerNamespace: string, 
  resourceType?: string
): Promise<string> {
  try {
    // Get Azure credential
    const credential = getAzureCredential();
    
    // Get access token
    const tokenResponse = await credential.getToken("https://management.azure.com/.default");
    if (!tokenResponse?.token) throw new Error("Failed to acquire Azure access token");

    // Prepare request options
    const headers = {
      'Authorization': `Bearer ${tokenResponse.token}`,
      'Content-Type': 'application/json'
    };
    
    // Make request to list provider details
    const url = `https://management.azure.com/providers/${providerNamespace}?api-version=2021-04-01`;
    const response = await fetch(url, { method: 'GET', headers });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API versions: ${response.status}`);
    }
    
    const providerData = await response.json();
    
    // If resourceType is specified, find that specific type
    if (resourceType) {
      const resourceTypeInfo = providerData.resourceTypes.find(
        (rt: any) => rt.resourceType.toLowerCase() === resourceType.toLowerCase()
      );
      
      if (resourceTypeInfo && resourceTypeInfo.apiVersions && resourceTypeInfo.apiVersions.length > 0) {
        // Return the first (most recent) API version
        return resourceTypeInfo.apiVersions[0];
      }
    } else {
      // Otherwise, just return a stable API version for the provider
      // Providers typically have their most recent versions first
      if (providerData.apiVersions && providerData.apiVersions.length > 0) {
        return providerData.apiVersions[0];
      }
    }
    
    // If we get here, we couldn't find a good API version
    throw new Error(`Could not find API version for ${providerNamespace}${resourceType ? '/' + resourceType : ''}`);
  } catch (error) {
    console.error(`Error fetching API versions: ${error instanceof Error ? error.message : String(error)}`);
    // Return a default fallback version - you might want to customize this per provider
    return '2021-04-01';
  }
}

// This Azure credential handling approach is similar to Lokka-Microsoft
function getAzureCredential(): DefaultAzureCredential | ClientSecretCredential {
  if (!azureCredential) {
    try {
      // Try DefaultAzureCredential which includes CLI credentials
      console.error("Attempting to use DefaultAzureCredential (will try Azure CLI if environment variables not set)");
      azureCredential = new DefaultAzureCredential();
    } catch (error) {
      // Fall back to ClientSecretCredential
      console.error(`DefaultAzureCredential failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error("Falling back to ClientSecretCredential");
      try {
        const { tenantId, clientId, clientSecret } = getCredentials();
        azureCredential = new ClientSecretCredential(tenantId, clientId, clientSecret);
      } catch (secretError) {
        console.error(`ClientSecretCredential failed: ${secretError instanceof Error ? secretError.message : String(secretError)}`);
        throw new Error("Failed to initialize any Azure credential. Please ensure you are logged in with 'az login' or have set environment variables.");
      }
    }
  }
  return azureCredential;
}

// Response formatting utilities inspired by Lokka-Microsoft
function formatApiResponse(apiType: 'Entra' | 'Azure', method: string, path: string, result: any): { content: Array<{ type: "text", text: string }> } {
  return {
    content: [
      {
        type: "text" as const,
        text: `${apiType} API Result (${method.toUpperCase()} ${path}):\n\n${JSON.stringify(result, null, 2)}`,
      },
    ],
  };
}

function formatErrorResponse(err: any, apiType: 'Entra' | 'Azure'): { content: Array<{ type: "text", text: string }> } {
  const errorDetail = err instanceof Error 
    ? {
        message: err.message,
        name: err.name,
        detail: apiType === 'Entra' 
          ? (err as any).body ? JSON.stringify((err as any).body) : undefined
          : (err as any).response?.body || undefined,
        status: (err as any).statusCode || (err as any).status
      }
    : String(err);
  
  return {
    content: [
      {
        type: "text" as const,
        text: `Error querying ${apiType} API: ${JSON.stringify(errorDetail, null, 2)}`,
      },
    ],
  };
}

// Process OData parameters for Graph API
function processODataParams({
  queryParams = {},
  select,
  filter,
  expand,
  orderBy,
  top,
  count
}: {
  queryParams: Record<string, string>;
  select?: string;
  filter?: string;
  expand?: string;
  orderBy?: string;
  top?: number;
  count?: boolean;
}): Record<string, string> {
  const processedParams = { ...queryParams };
  
  if (select) processedParams['$select'] = select;
  if (filter) processedParams['$filter'] = filter;
  if (expand) processedParams['$expand'] = expand;
  if (orderBy) processedParams['$orderby'] = orderBy;
  if (top !== undefined) processedParams['$top'] = top.toString();
  if (count) processedParams['$count'] = 'true';
  
  return processedParams;
}

// MICROSOFT GRAPH API TOOL
// This tool implementation is inspired by and adapted from Lokka-Microsoft's Graph API handling
server.tool(
  "askEntra",
  "Direct access to Microsoft Graph API for accurate Entra (Azure AD) data",
  {
    path: z.string().describe("The Graph API URL path (e.g. '/users/{id}/memberOf', '/directoryRoles')"),
    method: z.enum(["get", "post", "put", "patch", "delete"]).default("get").describe("HTTP method to use"),
    queryParams: z.record(z.string()).optional().describe("Query parameters for the request"),
    body: z.record(z.string(), z.any()).optional().describe("Request body for POST/PUT/PATCH requests"),
    apiVersion: z.enum(["v1.0", "beta"]).default("v1.0").describe("Microsoft Graph API version"),
    fetchAllPages: z.boolean().optional().default(false).describe("Automatically fetch all pages of results"),
    consistencyLevel: z.string().optional().describe("ConsistencyLevel header value (use 'eventual' for queries with $filter, $search, etc.)"),
    // Shorthand params
    select: z.string().optional().describe("Shorthand for $select query parameter"),
    filter: z.string().optional().describe("Shorthand for $filter query parameter"),
    expand: z.string().optional().describe("Shorthand for $expand query parameter"),
    orderBy: z.string().optional().describe("Shorthand for $orderBy query parameter"),
    top: z.number().optional().describe("Shorthand for $top query parameter"),
    count: z.boolean().optional().describe("Shorthand for $count=true to include count of items"),
  },
  async ({ 
    path, 
    method, 
    queryParams = {}, 
    body,
    apiVersion, 
    fetchAllPages, 
    consistencyLevel,
    select,
    filter,
    expand,
    orderBy,
    top,
    count
  }) => {
    try {
      // Process shorthand query parameters
      const processedParams = processODataParams({
        queryParams,
        select,
        filter,
        expand,
        orderBy,
        top,
        count
      });

      // Initialize client on demand
      if (!graphClient) {
        const credential = getAzureCredential();
        const authProvider = new TokenCredentialAuthenticationProvider(credential, {
          scopes: ["https://graph.microsoft.com/.default"],
        });
        graphClient = Client.initWithMiddleware({ authProvider });
      }
      
      // Build request with API path and version
      let request = graphClient.api(path).version(apiVersion);
      
      // Add query parameters
      if (Object.keys(processedParams).length > 0) {
        request = request.query(processedParams);
      }
      
      // Add consistency level header if provided
      if (consistencyLevel) {
        request = request.header('ConsistencyLevel', consistencyLevel);
      }
      
      // Handle pagination for GET requests
      let result;
      if (method === 'get' && fetchAllPages) {
        const firstPage = await request.get();
        
        // If no pagination needed, return first page
        if (!firstPage["@odata.nextLink"]) {
          result = firstPage;
        } else {
          // Collect all items from all pages
          const allItems = [...(firstPage.value || [])];
          let nextLink = firstPage["@odata.nextLink"];
          
          while (nextLink) {
            const nextPage = await graphClient.api(nextLink).get();
            if (nextPage.value) allItems.push(...nextPage.value);
            nextLink = nextPage["@odata.nextLink"] || null;
          }
          
          result = {
            "@odata.context": firstPage["@odata.context"],
            value: allItems,
            "@odata.count": firstPage["@odata.count"],
            totalItemsFetched: allItems.length
          };
        }
      } else {
        // Execute appropriate method
        switch (method) {
          case 'get': result = await request.get(); break;
          case 'post': result = await request.post(body || {}); break;
          case 'put': result = await request.put(body || {}); break;
          case 'patch': result = await request.patch(body || {}); break;
          case 'delete': 
            await request.delete();
            result = { status: "Successfully deleted" };
            break;
        }
      }
      
      return formatApiResponse('Entra', method, path, result);
    } catch (err) {
      return formatErrorResponse(err, 'Entra');
    }
  }
);

// Type for resource provider API versions
type ResourceProviderVersions = {
  // Core resources
  'resources': string;
  'resourceGroups': string;
  'subscriptions': string;
  'providers': string;
  'deployments': string;
  // Common resource providers
  'Microsoft.Compute/virtualMachines': string;
  'Microsoft.Storage/storageAccounts': string;
  'Microsoft.Network/virtualNetworks': string;
  'Microsoft.KeyVault/vaults': string;
  'Microsoft.Billing/billingAccounts': string;
  'Microsoft.CostManagement/query': string;
  [key: string]: string; // Allow other resource providers
};

// AZURE RESOURCE MANAGEMENT API TOOL
// This tool implementation is inspired by and adapted from Lokka-Microsoft's Azure API handling
server.tool(
  "askAzure",
  "Direct access to Azure Resource Management API for managing Azure resources",
  {
    path: z.string().describe("The Azure API path (e.g. '/subscriptions', '/resourceGroups/{name}')"),
    method: z.enum(["get", "post", "put", "patch", "delete"]).default("get").describe("HTTP method to use"),
    apiVersion: z.string().optional().describe("Azure API version - required for each Azure Resource Provider"),
    subscriptionId: z.string().optional().describe("Azure Subscription ID (if not included in path)"),
    body: z.record(z.string(), z.any()).optional().describe("Request body for POST/PUT/PATCH requests"),
    queryParams: z.record(z.string()).optional().describe("Additional query parameters"),
    fetchAllPages: z.boolean().optional().default(false).describe("Automatically fetch all pages of results"),
    // Predefined operations
    operation: z.enum([
      "listResources", "listResourceProviders", "getResourceProvider", 
      "registerResourceProvider", "getResourceTypes", "getApiVersions", 
      "getLocations", "createResource", "deployTemplate", "deleteResource", "custom"
    ]).optional().default("custom").describe("Predefined Azure operations"),
    // Parameters for predefined operations
    providerNamespace: z.string().optional().describe("Resource provider namespace (e.g. 'Microsoft.Compute')"),
    resourceType: z.string().optional().describe("Resource type for specific operations"),
    resourceGroupName: z.string().optional().describe("Resource group name for resource operations"),
    resourceName: z.string().optional().describe("Resource name for resource operations"),
  },
  async ({ 
    path, 
    method, 
    apiVersion, 
    subscriptionId, 
    body, 
    queryParams = {}, 
    fetchAllPages,
    operation = "custom",
    providerNamespace,
    resourceType,
    resourceGroupName,
    resourceName
  }) => {
    try {
      // Default API versions for common resource types
      const defaultApiVersions: ResourceProviderVersions = {
        'resources': '2021-04-01',
        'resourceGroups': '2021-04-01',
        'subscriptions': '2022-12-01',
        'providers': '2021-04-01',
        'deployments': '2021-04-01',
        'Microsoft.Compute/virtualMachines': '2023-03-01',
        'Microsoft.Storage/storageAccounts': '2023-01-01',
        'Microsoft.Network/virtualNetworks': '2023-04-01',
        'Microsoft.KeyVault/vaults': '2023-02-01',
        'Microsoft.Billing/billingAccounts': '2024-04-01',
        'Microsoft.CostManagement/query': '2023-03-01'
      };

      // Set default API version for common paths if not provided
      if (!apiVersion && !queryParams['api-version']) {
        if (path === '/subscriptions') {
          apiVersion = defaultApiVersions['subscriptions']; // Default API version for listing subscriptions
        }
      }

      let extractedProviderNamespace: string | null = null;

      // Try to extract provider namespace from the path if not explicitly provided
      if (!providerNamespace && path.includes('/providers/')) {
        const match = path.match(/\/providers\/([^\/]+)/);
        if (match && match[1]) {
          extractedProviderNamespace = match[1];
        }
      }

      // Handle predefined operations
      if (operation !== "custom") {
        const requiredSubscriptionId = !['listResourceProviders', 'getResourceProvider', 'registerResourceProvider'].includes(operation);
        if (requiredSubscriptionId && !subscriptionId) {
          throw new Error(`Operation '${operation}' requires a subscriptionId`);
        }

        switch (operation) {
          case 'listResources':
            path = resourceGroupName
              ? `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/resources`
              : `/subscriptions/${subscriptionId}/resources`;
            apiVersion = apiVersion || defaultApiVersions['resources'];
            break;

          case 'listResourceProviders':
            path = `/subscriptions/${subscriptionId}/providers`;
            apiVersion = apiVersion || defaultApiVersions['providers'];
            break;

          case 'getResourceProvider':
            if (!providerNamespace) throw new Error("Operation 'getResourceProvider' requires a providerNamespace");
            path = `/subscriptions/${subscriptionId}/providers/${providerNamespace}`;
            apiVersion = apiVersion || defaultApiVersions['providers'];
            break;

          case 'registerResourceProvider':
            if (!providerNamespace) throw new Error("Operation 'registerResourceProvider' requires a providerNamespace");
            path = `/subscriptions/${subscriptionId}/providers/${providerNamespace}/register`;
            method = 'post';
            apiVersion = apiVersion || defaultApiVersions['providers'];
            break;

          case 'getResourceTypes':
          case 'getApiVersions':
          case 'getLocations':
            if (!providerNamespace) throw new Error(`Operation '${operation}' requires providerNamespace`);
            path = `/subscriptions/${subscriptionId}/providers/${providerNamespace}`;
            apiVersion = apiVersion || defaultApiVersions['providers'];
            break;

          case 'createResource':
            if (!resourceGroupName || !providerNamespace || !resourceType || !resourceName) {
              throw new Error("Operation 'createResource' requires resourceGroupName, providerNamespace, resourceType, and resourceName");
            }
            if (!body) throw new Error("Operation 'createResource' requires a request body");
            path = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${providerNamespace}/${resourceType}/${resourceName}`;
            method = 'put';
            const providerResourceKey = `${providerNamespace}/${resourceType}`;
            // Try to get the API version for this resource type
            if (!apiVersion) {
              // First check our default versions
              apiVersion = defaultApiVersions[providerResourceKey];
              
              // If not found in defaults, try to fetch it dynamically
              if (!apiVersion && providerNamespace) {
                try {
                  apiVersion = await getLatestApiVersion(providerNamespace, resourceType);
                } catch (error) {
                  console.error(`Error fetching API version: ${error instanceof Error ? error.message : String(error)}`);
                  apiVersion = '2021-04-01'; // Fall back to a safe default
                }
              }
            }
            break;

          case 'deployTemplate':
            if (!resourceGroupName) throw new Error("Operation 'deployTemplate' requires resourceGroupName");
            if (!body?.properties?.template) throw new Error("Operation 'deployTemplate' requires a template in the body");
            const deploymentName = body.deploymentName || `deployment-${new Date().getTime()}`;
            delete body.deploymentName;
            path = `/subscriptions/${subscriptionId}/resourcegroups/${resourceGroupName}/providers/Microsoft.Resources/deployments/${deploymentName}`;
            method = 'put';
            apiVersion = apiVersion || defaultApiVersions['deployments'];
            break;

          case 'deleteResource':
            if (!resourceGroupName || !providerNamespace || !resourceType || !resourceName) {
              throw new Error("Operation 'deleteResource' requires resourceGroupName, providerNamespace, resourceType, and resourceName");
            }
            path = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${providerNamespace}/${resourceType}/${resourceName}`;
            method = 'delete';
            const deleteResourceKey = `${providerNamespace}/${resourceType}`;
            // Try to get the API version for this resource type
            if (!apiVersion) {
              // First check our default versions
              apiVersion = defaultApiVersions[deleteResourceKey]; 
              
              // If not found in defaults, try to fetch it dynamically
              if (!apiVersion && providerNamespace) {
                try {
                  apiVersion = await getLatestApiVersion(providerNamespace, resourceType);
                } catch (error) {
                  console.error(`Error fetching API version: ${error instanceof Error ? error.message : String(error)}`);
                  apiVersion = '2021-04-01'; // Fall back to a safe default
                }
              }
            }
            break;
        }
      } else if (extractedProviderNamespace && !apiVersion && !queryParams['api-version']) {
        // For custom operations, try to get the API version based on the path
        try {
          // Try to extract resource type from path if possible
          let extractedResourceType: string | undefined;
          const resourceTypeMatch = path.match(/\/providers\/[^\/]+\/([^\/]+)\/?/);
          if (resourceTypeMatch && resourceTypeMatch[1]) {
            extractedResourceType = resourceTypeMatch[1];
          }
          
          // Fetch the latest API version
          apiVersion = await getLatestApiVersion(extractedProviderNamespace, extractedResourceType);
        } catch (error) {
          console.error(`Error fetching API version from path: ${error instanceof Error ? error.message : String(error)}`);
          // Don't set a default here, let the error handling below catch it
        }
      }

      // Ensure API version is provided
      if (!apiVersion && !queryParams['api-version']) {
        throw new Error("Azure Resource Management API requires an 'apiVersion' parameter");
      }

      // Get Azure credential
      const credential = getAzureCredential();

      // Construct the base URL and path
      const baseUrl = "https://management.azure.com";
      let fullPath = path;
      if (subscriptionId && !path.includes('/subscriptions/')) {
        fullPath = `/subscriptions/${subscriptionId}${path.startsWith('/') ? path : `/${path}`}`;
      }

      // Add api-version and other query parameters
      const params = new URLSearchParams(queryParams);
      if (apiVersion) params.set('api-version', apiVersion);

      // Get access token
      const tokenResponse = await credential.getToken("https://management.azure.com/.default");
      if (!tokenResponse?.token) throw new Error("Failed to acquire Azure access token");

      // Prepare request options
      const headers = {
        'Authorization': `Bearer ${tokenResponse.token}`,
        'Content-Type': 'application/json'
      };
      
      const options: RequestInit = { 
        method: method.toUpperCase(), 
        headers 
      };
      
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
        options.body = JSON.stringify(body);
      }

      // Construct URL
      const url = `${baseUrl}${fullPath}?${params.toString()}`;

      // Execute request with pagination if needed
      let result;
      if (method === 'get' && fetchAllPages) {
        // Fetch first page
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Azure API error: ${response.status} - ${errorText}`);
        }
        
        const firstPage = await response.json();
        
        // If no pagination needed, return first page
        if (!firstPage.nextLink) {
          result = firstPage;
        } else {
          // Collect all items from all pages
          const allItems = [...(firstPage.value || [])];
          let nextLink = firstPage.nextLink;
          
          while (nextLink) {
            const pageResponse = await fetch(nextLink, options);
            if (!pageResponse.ok) throw new Error(`Azure API pagination error: ${pageResponse.status}`);
            
            const nextPage = await pageResponse.json();
            if (nextPage.value) allItems.push(...nextPage.value);
            nextLink = nextPage.nextLink || null;
          }
          
          result = {
            value: allItems,
            count: allItems.length
          };
        }
      } else {
        // Single page request
        const response = await fetch(url, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorDetail;
          try {
            errorDetail = JSON.parse(errorText);
          } catch {
            errorDetail = errorText;
          }
          
          const error = new Error(`Azure API error: ${response.status}`);
          (error as any).status = response.status;
          (error as any).response = { body: errorDetail };
          throw error;
        }
        
        const text = await response.text();
        result = text ? JSON.parse(text) : { status: "Success" };
      }
      
      return formatApiResponse('Azure', method, path, result);
    } catch (err) {
      return formatErrorResponse(err, 'Azure');
    }
  }
);

// SERVER STARTUP
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("EntraAware MCP Server running on stdio");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
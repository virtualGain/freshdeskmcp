// Example client for the Freshdesk MCP server
// This demonstrates how to connect to the server and use its tools and resources

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  // Create a transport that connects to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['../build/index.js'],
    env: {
      FD_KEY: process.env.FD_KEY,
      FD_DOMAIN: process.env.FD_DOMAIN
    }
  });

  // Create the client
  const client = new Client({
    name: 'example-client',
    version: '1.0.0'
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to Freshdesk MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:', tools.map(tool => tool.name));

    // Search for articles
    console.log('\nSearching for articles about "password reset"...');
    const searchResult = await client.callTool({
      name: 'search-articles',
      arguments: {
        query: 'password reset'
      }
    });
    console.log('Search results:', JSON.parse(searchResult.content[0].text));

    // Get categories and folders
    console.log('\nGetting categories and folders...');
    const categoriesResult = await client.callTool({
      name: 'get-categories',
      arguments: {}
    });
    console.log('Categories and folders:', JSON.parse(categoriesResult.content[0].text));

    // List available resources
    const resources = await client.listResources();
    console.log('\nAvailable resources:', resources.map(resource => resource.uri || resource.uriTemplate));

    // Read all articles resource
    console.log('\nReading all articles...');
    const articlesResource = await client.readResource('freshdesk://articles');
    console.log('Articles:', JSON.parse(articlesResource.contents[0].text));

    // Read a specific article (assuming article ID 1 exists)
    console.log('\nReading article with ID 1...');
    const articleResource = await client.readResource('freshdesk://article/1');
    console.log('Article:', JSON.parse(articleResource.contents[0].text));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the client
    await client.close();
  }
}

main();
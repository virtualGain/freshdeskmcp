// Simple test script to verify the Freshdesk MCP server is working correctly
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Check for required environment variables
const apiKey = process.env.FD_KEY;
const domain = process.env.FD_DOMAIN;

if (!apiKey || !domain) {
  console.error('Error: FD_KEY and FD_DOMAIN environment variables are required');
  process.exit(1);
}


/**
 * Lists all Freshdesk solution categories and their folders
 * @param {Client} client - The MCP client
 */
async function listAllCategories(client) {
  console.log('\n📂 Listing all Freshdesk solution categories:');
  console.log('-------------------------------------------');
  
  try {
    // Call the get-categories tool
    const result = await client.callTool({
      name: 'get-categories',
      arguments: {}
    });
    
    // Check if result has the expected structure
    if (!result || !result.content || !result.content[0] || !result.content[0].text) {
      console.log('Unexpected result structure:', result);
      return;
    }
    
    // Parse the JSON response
    const categoriesData = JSON.parse(result.content[0].text);
    
    // Check if categoriesData is an array
    if (!Array.isArray(categoriesData)) {
      console.log('Unexpected categories structure:', categoriesData);
      return;
    }
    
    if (categoriesData.length === 0) {
      console.log('No categories found.');
      return;
    }
    
    // Display categories and their folders
    categoriesData.forEach((item, index) => {
      const { category, folders } = item;
      console.log(`${index + 1}. Category: ${category.name} [ID: ${category.id}]`);
      console.log(`   Description: ${category.description || 'N/A'}`);
      
      if (folders && folders.length > 0) {
        console.log('   Folders:');
        folders.forEach((folder, folderIndex) => {
          console.log(`     ${folderIndex + 1}. ${folder.name} [ID: ${folder.id}]`);
        });
      } else {
        console.log('   Folders: None');
      }
      
      console.log(''); // Empty line for better readability
    });
    
    console.log(`Total categories: ${categoriesData.length}`);
  } catch (error) {
    console.error('❌ Error listing categories:', error.message);
    // Log the full error for debugging
    console.error('Full error:', error);
  }
}

async function testServer() {
  console.log('Testing Freshdesk MCP server...');
  
  // Create a transport that connects to the server
  const transport = new StdioClientTransport({
    command: process.execPath, // Use the current Node.js executable path
    args: ['./build/index.js'],
    env: {
      FD_KEY: apiKey,
      FD_DOMAIN: domain
    }
  });

  // Create the client
  const client = new Client({
    name: 'test-client',
    version: '1.0.0'
  });

  try {
    // Connect to the server
    await client.connect(transport);
    console.log('✅ Connected to Freshdesk MCP server');

    // List available tools
    const tools = await client.listTools();
    if (Array.isArray(tools)) {
      console.log('✅ Available tools:', tools.map(tool => tool.name));
    } else {
      console.log('✅ Available tools:', tools);
      // If tools is an object with a tools property that is an array
      if (tools && typeof tools === 'object' && Array.isArray(tools.tools)) {
        console.log('✅ Tool names:', tools.tools.map(tool => tool.name));
      }
    }

    // List available resources
    const resources = await client.listResources();
    if (Array.isArray(resources)) {
      console.log('✅ Available resources:', resources.map(resource => resource.uri || resource.uriTemplate));
    } else {
      console.log('✅ Available resources:', resources);
      // If resources is an object with a resources property that is an array
      if (resources && typeof resources === 'object' && Array.isArray(resources.resources)) {
        console.log('✅ Resource URIs:', resources.resources.map(resource => resource.uri || resource.uriTemplate));
      }
    }
    
    // List all categories
    await listAllCategories(client);

    console.log('\nAll tests passed! The Freshdesk MCP server is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    // Close the client
    await client.close();
  }
}

testServer();
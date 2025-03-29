#!/usr/bin/env node

import { config } from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { z } from 'zod';
import { FreshdeskAPI } from './freshdesk-api.js';
import { URL } from 'url';

// Load environment variables
config();

// Check for required environment variables
const apiKey = process.env.FD_KEY;
const domain = process.env.FD_DOMAIN;

if (!apiKey || !domain) {
  console.error('Error: FD_KEY and FD_DOMAIN environment variables are required');
  process.exit(1);
}

// Initialize Freshdesk API client
const freshdesk = new FreshdeskAPI(apiKey, domain);

// Create MCP server
const server = new McpServer({
  name: 'freshdesk',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Add a resource to get all solution articles
server.resource(
  'all-articles',
  'freshdesk://articles',
  async (uri: URL) => {
    try {
      const articles = await freshdesk.getAllArticles();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(articles, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      console.error('Error fetching all articles:', error);
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching articles: ${error instanceof Error ? error.message : String(error)}`,
          mimeType: 'text/plain'
        }]
      };
    }
  }
);

// Add a resource to get a specific article
server.resource(
  'article',
  'freshdesk://article/{id}',
  async (uri: URL, extra: RequestHandlerExtra) => {
    // Extract the ID from the URL path
    const pathParts = uri.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    try {
      const articleId = parseInt(id, 10);
      if (isNaN(articleId)) {
        throw new Error('Invalid article ID');
      }
      
      const article = await freshdesk.getArticle(articleId);
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(article, null, 2),
          mimeType: 'application/json'
        }]
      };
    } catch (error) {
      console.error(`Error fetching article ${id}:`, error);
      return {
        contents: [{
          uri: uri.href,
          text: `Error fetching article: ${error instanceof Error ? error.message : String(error)}`,
          mimeType: 'text/plain'
        }]
      };
    }
  }
);

// Add a tool to search for articles
server.tool(
  'search-articles',
  'Search for solution articles in Freshdesk',
  {
    query: z.string().describe('Search query for finding articles')
  },
  async ({ query }: { query: string }) => {
    try {
      const results = await freshdesk.searchArticles(query);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error searching articles:', error);
      return {
        content: [{
          type: 'text',
          text: `Error searching articles: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Add a tool to get categories and folders
server.tool(
  'get-categories',
  'Get all solution categories and their folders',
  {},
  async () => {
    try {
      const categories = await freshdesk.getCategories();
      const result = [];
      
      // Check if categories is iterable
      if (!categories || !Array.isArray(categories)) {
        throw new Error('Invalid categories response: categories is not an array');
      }
      
      for (const category of categories) {
        const folders = await freshdesk.getFolders(category.id);
        result.push({
          category,
          folders
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Return error as valid JSON
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: true,
            message: `Error fetching categories: ${error instanceof Error ? error.message : String(error)}`
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Freshdesk MCP server started');
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

main();
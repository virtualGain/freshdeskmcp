#!/usr/bin/env node

import { config } from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { z } from 'zod';
import { FreshdeskAPI } from './freshdesk-api.js';
import { URL } from 'url';
// Import Enums and Types
import {
    TicketStatus, TicketPriority, TicketSource,
    FreshdeskTicketUpdatePayload,
    FreshdeskTicketFieldCreatePayload, FreshdeskTicketFieldUpdatePayload,
    // Import Contact Payloads
    FreshdeskContactCreatePayload, FreshdeskContactUpdatePayload,
    FreshdeskContactFieldCreatePayload, FreshdeskContactFieldUpdatePayload,
    FreshdeskTicketFilters
} from './types.js';

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

// --- Resources ---

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

// --- Tools ---

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
  {}, // No input parameters needed
  async () => {
    try {
      const categories = await freshdesk.getCategories();
      const result = [];

      // Check if categories is iterable
      if (!categories || !Array.isArray(categories)) {
        throw new Error('Invalid categories response: categories is not an array');
      }

      for (const category of categories) {
        // Handle potential errors when fetching folders for a specific category
        try {
            const folders = await freshdesk.getFolders(category.id);
            result.push({
              category,
              folders
            });
        } catch (error) {
            console.error(`Error fetching folders for category ${category.id}:`, error);
            // Optionally add error info to the result for this category
             result.push({
               category,
               folders: [],
               error: `Failed to fetch folders: ${error instanceof Error ? error.message : String(error)}`
             });
        }
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

// --- Ticket Tools ---

// Tool to create a ticket
server.tool(
  'create-ticket',
  'Create a new ticket in Freshdesk',
  {
    // Required fields
    subject: z.string().describe('Subject of the ticket'),
    description: z.string().describe('HTML content of the ticket description'),
    
    // Status, priority, and source as numbers with descriptions of values
    status: z.number().int().min(2).max(5).default(2)
      .describe('Status of the ticket: 2=Open, 3=Pending, 4=Resolved, 5=Closed (default: 2)'),
    priority: z.number().int().min(1).max(4).default(1)
      .describe('Priority of the ticket: 1=Low, 2=Medium, 3=High, 4=Urgent (default: 1)'),
    source: z.number().int().min(1).max(10).default(2)
      .describe('Source of the ticket: 1=Email, 2=Portal, 3=Phone, 7=Chat, 9=Feedback Widget, 10=Outbound Email (default: 2)'),
    
    // Requester identification - at least one is required
    email: z.string().email().optional()
      .describe('Email address of the requester. If no contact exists with this email, it will be added as a new contact.'),
    requester_id: z.number().int().positive().optional()
      .describe('User ID of the requester. For existing contacts, this can be passed instead of the email.'),
    facebook_id: z.string().optional()
      .describe('Facebook ID of the requester. A contact should exist with this facebook_id in Freshdesk.'),
    phone: z.string().optional()
      .describe('Phone number of the requester. If no contact exists with this phone, it will be added as a new contact.'),
    twitter_id: z.string().optional()
      .describe('Twitter handle of the requester. If no contact exists with this handle, it will be added as a new contact.'),
    unique_external_id: z.string().optional()
      .describe('External ID of the requester. If no contact exists with this external ID, they will be added as a new contact.'),
    name: z.string().optional()
      .describe('Name of the requester. Required if phone is provided but email is not.'),
    
    // Optional fields
    type: z.string().optional()
      .describe('Helps categorize the ticket according to the different kinds of issues your support team deals with.'),
    responder_id: z.number().int().positive().optional()
      .describe('ID of the agent to whom the ticket is assigned'),
    cc_emails: z.array(z.string().email()).optional()
      .describe('Email addresses added in the CC field of the ticket'),
    custom_fields: z.record(z.any()).optional()
      .describe('Key-value pairs for custom fields (e.g., {"cf_order_id": "123"})'),
    due_by: z.string().optional()
      .describe('Timestamp that denotes when the ticket is due to be resolved (ISO date format)'),
    email_config_id: z.number().int().positive().optional()
      .describe('ID of email config to use for this ticket (e.g., support@company.com/sales@company.com)'),
    fr_due_by: z.string().optional()
      .describe('Timestamp that denotes when the first response is due (ISO date format)'),
    group_id: z.number().int().positive().optional()
      .describe('ID of the group to which the ticket is assigned'),
    parent_id: z.number().int().positive().optional()
      .describe('ID of the parent ticket to link this ticket to (will convert this to a child ticket)'),
    product_id: z.number().int().positive().optional()
      .describe('ID of the product to which the ticket is associated'),
    tags: z.array(z.string()).optional()
      .describe('Tags to associate with the ticket'),
    company_id: z.number().int().positive().optional()
      .describe('Company ID of the requester (requires Multiple Companies feature enabled)'),
    internal_agent_id: z.number().int().positive().optional()
      .describe('ID of the internal agent to assign the ticket to'),
    internal_group_id: z.number().int().positive().optional()
      .describe('ID of the internal group to assign the ticket to'),
    lookup_parameter: z.string().optional()
      .describe('Value for custom objects lookup field (requires Custom Objects enabled)')
  },
  async (input) => { // Use direct input without type assertion
    // Perform the refinement check inside the handler
    if (!input.email && !input.requester_id && !input.facebook_id && !input.phone && 
        !input.twitter_id && !input.unique_external_id) {
      return {
        content: [{
          type: 'text',
          text: 'Validation Error: At least one requester identifier (email, requester_id, facebook_id, phone, twitter_id, or unique_external_id) must be provided.'
        }],
        isError: true
      };
    }
    
    // Additional validation: If phone is provided but email is not, name is required
    if (input.phone && !input.email && !input.name) {
      return {
        content: [{
          type: 'text',
          text: 'Validation Error: Name is required when using phone without an email address.'
        }],
        isError: true
      };
    }

    try {
      // Input is validated, pass directly to API
      const createdTicket = await freshdesk.createTicket(input);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(createdTicket, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error creating ticket:', error);
      return {
        content: [{
          type: 'text',
          text: `Error creating ticket: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to get a specific ticket
server.tool(
  'get-ticket',
  'Retrieve a specific ticket by its ID',
  {
    ticket_id: z.number().int().positive().describe('The ID of the ticket to retrieve')
  },
  async ({ ticket_id }: { ticket_id: number }) => {
    try {
      const ticket = await freshdesk.getTicket(ticket_id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(ticket, null, 2)
        }]
      };
    } catch (error) {
      console.error(`Error fetching ticket ${ticket_id}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error fetching ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true // Indicate that the tool execution resulted in an error
      };
    }
  }
);

// Tool to update a ticket
server.tool(
  'update-ticket',
  'Update an existing ticket in Freshdesk',
  {
    ticket_id: z.number().int().positive().describe('The ID of the ticket to update'),
    
    // Fields that can be updated
    subject: z.string().optional().describe('New subject for the ticket'),
    description: z.string().optional().describe('New HTML content for the ticket description'),
    
    // Status, priority, and source as numbers with descriptions of values
    status: z.number().int().min(2).max(5).optional()
      .describe('New status for the ticket: 2=Open, 3=Pending, 4=Resolved, 5=Closed'),
    priority: z.number().int().min(1).max(4).optional()
      .describe('New priority for the ticket: 1=Low, 2=Medium, 3=High, 4=Urgent'),
    source: z.number().int().min(1).max(10).optional()
      .describe('New source for the ticket: 1=Email, 2=Portal, 3=Phone, 7=Chat, 9=Feedback Widget, 10=Outbound Email'),
    
    // Requester identification
    name: z.string().optional().describe('New name of the requester'),
    email: z.string().email().optional()
      .describe('New email address of the requester. If no contact exists with this email, it will be added as a new contact.'),
    requester_id: z.number().int().positive().optional()
      .describe('New user ID of the requester. For existing contacts, can be passed instead of the email.'),
    facebook_id: z.string().optional()
      .describe('New Facebook ID of the requester. A contact should exist with this facebook_id in Freshdesk.'),
    phone: z.string().optional()
      .describe('New phone number of the requester. If no contact exists with this phone, it will be added as a new contact.'),
    twitter_id: z.string().optional()
      .describe('New Twitter handle of the requester. If no contact exists with this handle, it will be added as a new contact.'),
    unique_external_id: z.string().optional()
      .describe('New external ID of the requester. If no contact exists with this external ID, they will be added as a new contact.'),
    
    // Other fields
    type: z.string().optional()
      .describe('New categorization of the ticket'),
    responder_id: z.number().int().positive().optional()
      .describe('New ID of the agent to whom the ticket is assigned'),
    custom_fields: z.record(z.any()).optional()
      .describe('New key-value pairs for custom fields (merges/overwrites existing)'),
    due_by: z.string().optional()
      .describe('New timestamp that denotes when the ticket is due to be resolved (ISO date format)'),
    email_config_id: z.number().int().positive().optional()
      .describe('New ID of email config to use for this ticket'),
    fr_due_by: z.string().optional()
      .describe('New timestamp that denotes when the first response is due (ISO date format)'),
    group_id: z.number().int().positive().optional()
      .describe('New ID of the group to which the ticket is assigned'),
    parent_id: z.number().int().positive().optional()
      .describe('New ID of the parent ticket to link this ticket to (will convert this to a child ticket)'),
    product_id: z.number().int().positive().optional()
      .describe('New ID of the product to which the ticket is associated'),
    tags: z.array(z.string()).optional()
      .describe('New tags to associate with the ticket (replaces existing tags)'),
    company_id: z.number().int().positive().optional()
      .describe('New company ID of the requester (requires Multiple Companies feature enabled)'),
    internal_agent_id: z.number().int().positive().optional()
      .describe('New ID of the internal agent to assign the ticket to'),
    internal_group_id: z.number().int().positive().optional()
      .describe('New ID of the internal group to assign the ticket to'),
    lookup_parameter: z.string().optional()
      .describe('New value for custom objects lookup field (requires Custom Objects enabled)')
  },
  async (input) => {
    const { ticket_id, ...updatePayload } = input; // Separate ticket_id from the payload

    // Ensure there's something to update
    if (Object.keys(updatePayload).length === 0) {
        return {
            content: [{
                type: 'text',
                text: 'Validation Error: At least one field must be provided to update the ticket.'
            }],
            isError: true
        };
    }

    try {
      const updatedTicket = await freshdesk.updateTicket(ticket_id, updatePayload);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(updatedTicket, null, 2)
        }]
      };
    } catch (error) {
      console.error(`Error updating ticket ${ticket_id}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error updating ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to delete a ticket
server.tool(
  'delete-ticket',
  'Delete a specific ticket by its ID',
  {
    ticket_id: z.number().int().positive().describe('The ID of the ticket to delete')
  },
  async ({ ticket_id }: { ticket_id: number }) => {
    try {
      await freshdesk.deleteTicket(ticket_id); // API method handles 204 response
      return {
        content: [{
          type: 'text',
          text: `Ticket ${ticket_id} deleted successfully.`
        }]
      };
    } catch (error) {
      console.error(`Error deleting ticket ${ticket_id}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error deleting ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to list tickets with pagination
server.tool(
  'list-tickets',
  'List tickets from Freshdesk with pagination and filtering support',
  {
      page: z.number().int().positive().optional().default(1).describe('Page number to retrieve (default: 1)'),
      per_page: z.number().int().min(1).max(100).optional().default(30).describe('Number of tickets per page (default: 30, max: 100)'),
      
      // Direct filter parameters
      filter: z.string().optional().describe('Filter tickets by predefined filters'),
      requester_id: z.number().int().positive().optional().describe('Filter by requester ID'),
      email: z.string().email().optional().describe('Filter by requester email'),
      unique_external_id: z.string().optional().describe('Filter by unique external ID'),
      company_id: z.number().int().positive().optional().describe('Filter by company ID'),
      updated_since: z.string().optional().describe('Filter tickets updated since timestamp (ISO 8601 format)'),
      
      // Sorting parameters
      created_at: z.enum(['asc', 'desc']).optional().describe('Sort by creation date'),
      due_by: z.enum(['asc', 'desc']).optional().describe('Sort by due date'),
      updated_at: z.enum(['asc', 'desc']).optional().describe('Sort by last updated date'),
      status_sort: z.enum(['asc', 'desc']).optional().describe('Sort by status'),
      
      // Lucene query parameter - supports advanced filtering
      query: z.string().optional().describe('Advanced filter using Lucene syntax. Example: "status:2" for open tickets, "priority:3 AND agent_id:123", "tag:\'urgent\'"')
  },
  async (input) => {
      try {
          const { page, per_page, status_sort, ...restFilters } = input;
          
          // Map status_sort to status since we renamed it to avoid conflict
          const filters: FreshdeskTicketFilters = {
            ...restFilters,
            status: status_sort
          };
          
          const result = await freshdesk.listTickets(page, per_page, filters);
          return {
              content: [{
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
              }]
          };
      } catch (error) {
          console.error('Error listing tickets:', error);
          return {
              content: [{
                  type: 'text',
                  text: `Error listing tickets: ${error instanceof Error ? error.message : String(error)}`
              }],
              isError: true
          };
      }
  }
);

// Tool to search tickets
server.tool(
  'search-tickets',
  'Search for tickets using a query string (Lucene syntax)',
  {
      query: z.string().describe('Search query (Lucene syntax, e.g., "subject:\'Support Request\' AND status:2")')
  },
  async ({ query }: { query: string }) => {
      try {
          const results = await freshdesk.searchTickets(query);
          return {
              content: [{
                  type: 'text',
                  text: JSON.stringify(results, null, 2)
              }]
          };
      } catch (error) {
          console.error('Error searching tickets:', error);
          return {
              content: [{
                  type: 'text',
                  text: `Error searching tickets: ${error instanceof Error ? error.message : String(error)}`
              }],
              isError: true
          };
      }
  }
);

// Tool to get ticket conversations
server.tool(
    'get-ticket-conversation',
    'Retrieve all conversations (replies and notes) for a specific ticket',
    {
        ticket_id: z.number().int().positive().describe('The ID of the ticket')
    },
    async ({ ticket_id }: { ticket_id: number }) => {
        try {
            const conversations = await freshdesk.getTicketConversation(ticket_id);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(conversations, null, 2)
                }]
            };
        } catch (error) {
            console.error(`Error fetching conversation for ticket ${ticket_id}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `Error fetching conversation for ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// Tool to create a ticket reply
server.tool(
    'create-ticket-reply',
    'Create a reply to a ticket',
    {
        ticket_id: z.number().int().positive().describe('The ID of the ticket to reply to'),
        body: z.string().describe('HTML content of the reply'),
        user_id: z.number().int().positive().optional().describe('Agent ID sending the reply (defaults to API key owner)'),
        cc_emails: z.array(z.string().email()).optional().describe('Array of CC email addresses'),
        bcc_emails: z.array(z.string().email()).optional().describe('Array of BCC email addresses')
    },
    async (input: { ticket_id: number, body: string, user_id?: number, cc_emails?: string[], bcc_emails?: string[] }) => {
        const { ticket_id, ...payload } = input;
        try {
            const reply = await freshdesk.createTicketReply(ticket_id, payload);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(reply, null, 2)
                }]
            };
        } catch (error) {
            console.error(`Error creating reply for ticket ${ticket_id}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `Error creating reply for ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// Tool to create a ticket note
server.tool(
    'create-ticket-note',
    'Create a note for a ticket',
    {
        ticket_id: z.number().int().positive().describe('The ID of the ticket to add a note to'),
        body: z.string().describe('HTML content of the note'),
        private: z.boolean().optional().default(true).describe('Set to false for a public note (default: true)'),
        user_id: z.number().int().positive().optional().describe('Agent ID creating the note (defaults to API key owner)')
    },
    async (input: { ticket_id: number, body: string, private?: boolean, user_id?: number }) => {
        const { ticket_id, ...payload } = input;
        try {
            const note = await freshdesk.createTicketNote(ticket_id, payload);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(note, null, 2)
                }]
            };
        } catch (error) {
            console.error(`Error creating note for ticket ${ticket_id}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `Error creating note for ticket ${ticket_id}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// --- Ticket Field Tools ---

// Tool to get all ticket fields
server.tool(
    'get-ticket-fields',
    'Retrieve all available ticket fields',
    {}, // No input parameters
    async () => {
        try {
            const fields = await freshdesk.getTicketFields();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(fields, null, 2)
                }]
            };
        } catch (error) {
            console.error('Error fetching ticket fields:', error);
            return {
                content: [{
                    type: 'text',
                    text: `Error fetching ticket fields: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// Tool to view a specific ticket field
server.tool(
    'view-ticket-field',
    'Retrieve details of a specific ticket field by its ID',
    {
        field_id: z.number().int().positive().describe('The ID of the ticket field to retrieve')
    },
    async ({ field_id }: { field_id: number }) => {
        try {
            const field = await freshdesk.viewTicketField(field_id);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(field, null, 2)
                }]
            };
        } catch (error) {
            console.error(`Error fetching ticket field ${field_id}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `Error fetching ticket field ${field_id}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// Define the input type for create-ticket-field handler
type CreateTicketFieldInput = FreshdeskTicketFieldCreatePayload;

// Tool to create a ticket field
server.tool(
    'create-ticket-field',
    'Create a new custom ticket field',
    {
        label: z.string().describe('Display label for the field (for agents)'),
        type: z.string().describe('Type of the field (e.g., custom_text, custom_dropdown, custom_checkbox)'),
        description: z.string().optional().describe('Description of the field'),
        position: z.number().int().positive().optional().describe('Position of the field in the form'),
        required_for_closure: z.boolean().optional().describe('Whether the field is mandatory for closing tickets'),
        required_for_agents: z.boolean().optional().describe('Whether the field is mandatory for agents'),
        customers_can_edit: z.boolean().optional().describe('Whether customers can edit this field in the portal'),
        label_for_customers: z.string().optional().describe('Display label for the field (for customers)'),
        required_for_customers: z.boolean().optional().describe('Whether the field is mandatory for customers in the portal'),
        displayed_for_customers: z.boolean().optional().describe('Whether the field is displayed to customers in the portal'),
        choices: z.array(z.any()).optional().describe('Array of choices for dropdown fields (e.g., ["Choice 1", "Choice 2"])') // Adjust 'any' based on expected choice structure
    },
    async (input: CreateTicketFieldInput) => {
        // Basic validation for dropdown choices
        if (input.type === 'custom_dropdown' && (!input.choices || input.choices.length === 0)) {
             return {
                 content: [{ type: 'text', text: 'Validation Error: Choices are required for dropdown fields.' }],
                 isError: true
             };
        }
        try {
            const newField = await freshdesk.createTicketField(input);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(newField, null, 2)
                }]
            };
        } catch (error) {
            console.error('Error creating ticket field:', error);
            return {
                content: [{
                    type: 'text',
                    text: `Error creating ticket field: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// Define the input type for update-ticket-field handler
type UpdateTicketFieldInput = { field_id: number } & FreshdeskTicketFieldUpdatePayload;

// Tool to update a ticket field
server.tool(
    'update-ticket-field',
    'Update an existing custom ticket field',
    {
        field_id: z.number().int().positive().describe('The ID of the ticket field to update'),
        label: z.string().optional().describe('New display label for the field (for agents)'),
        description: z.string().optional().describe('New description of the field'),
        position: z.number().int().positive().optional().describe('New position of the field in the form'),
        required_for_closure: z.boolean().optional().describe('New value for mandatory for closing tickets'),
        required_for_agents: z.boolean().optional().describe('New value for mandatory for agents'),
        customers_can_edit: z.boolean().optional().describe('New value for whether customers can edit this field'),
        label_for_customers: z.string().optional().describe('New display label for the field (for customers)'),
        required_for_customers: z.boolean().optional().describe('New value for mandatory for customers'),
        displayed_for_customers: z.boolean().optional().describe('New value for displayed to customers'),
        choices: z.array(z.any()).optional().describe('New array of choices for dropdown fields') // Adjust 'any'
    },
    async (input: UpdateTicketFieldInput) => {
        const { field_id, ...payload } = input;

        if (Object.keys(payload).length === 0) {
            return {
                content: [{ type: 'text', text: 'Validation Error: At least one field must be provided to update.' }],
                isError: true
            };
        }

        try {
            const updatedField = await freshdesk.updateTicketField(field_id, payload);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(updatedField, null, 2)
                }]
            };
        } catch (error) {
            console.error(`Error updating ticket field ${field_id}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `Error updating ticket field ${field_id}: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
            };
        }
    }
);

// --- Contact Tools ---

// Tool to list contacts
server.tool(
    'list-contacts',
    'List contacts from Freshdesk with pagination support',
    {
        page: z.number().int().positive().optional().default(1).describe('Page number to retrieve (default: 1)'),
        per_page: z.number().int().min(1).max(100).optional().default(30).describe('Number of contacts per page (default: 30, max: 100)')
    },
    async ({ page, per_page }: { page?: number, per_page?: number }) => {
        try {
            const result = await freshdesk.listContacts(page, per_page);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        } catch (error) {
            console.error('Error listing contacts:', error);
            return {
                content: [{ type: 'text', text: `Error listing contacts: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Tool to get a specific contact
server.tool(
    'get-contact',
    'Retrieve a specific contact by its ID',
    {
        contact_id: z.number().int().positive().describe('The ID of the contact to retrieve')
    },
    async ({ contact_id }: { contact_id: number }) => {
        try {
            const contact = await freshdesk.getContact(contact_id);
            return {
                content: [{ type: 'text', text: JSON.stringify(contact, null, 2) }]
            };
        } catch (error) {
            console.error(`Error fetching contact ${contact_id}:`, error);
            return {
                content: [{ type: 'text', text: `Error fetching contact ${contact_id}: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Define input type for create-contact
type CreateContactInput = FreshdeskContactCreatePayload;

// Tool to create a contact
server.tool(
    'create-contact',
    'Create a new contact in Freshdesk',
    {
        name: z.string().describe('Name of the contact'),
        email: z.string().email().optional().describe('Primary email address of the contact'),
        phone: z.string().optional().describe('Primary phone number of the contact'),
        mobile: z.string().optional().describe('Mobile number of the contact'),
        twitter_id: z.string().optional().describe('Twitter handle of the contact'),
        unique_external_id: z.string().optional().describe('External ID for the contact'),
        address: z.string().optional().describe('Address of the contact'),
        company_id: z.number().int().positive().optional().describe('ID of the company the contact belongs to'),
        description: z.string().optional().describe('Description of the contact'),
        job_title: z.string().optional().describe('Job title of the contact'),
        language: z.string().optional().describe('Language of the contact (e.g., "en")'),
        tags: z.array(z.string()).optional().describe('Tags associated with the contact'),
        time_zone: z.string().optional().describe('Time zone of the contact (e.g., "Eastern Time (US & Canada)")'),
        custom_fields: z.record(z.any()).optional().describe('Custom fields for the contact'),
        other_emails: z.array(z.string().email()).optional().describe('Additional email addresses')
    },
    async (input: CreateContactInput) => {
        try {
            const newContact = await freshdesk.createContact(input);
            return {
                content: [{ type: 'text', text: JSON.stringify(newContact, null, 2) }]
            };
        } catch (error) {
            console.error('Error creating contact:', error);
            return {
                content: [{ type: 'text', text: `Error creating contact: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Define input type for update-contact
type UpdateContactInput = { contact_id: number } & FreshdeskContactUpdatePayload;

// Tool to update a contact
server.tool(
    'update-contact',
    'Update an existing contact in Freshdesk',
    {
        contact_id: z.number().int().positive().describe('The ID of the contact to update'),
        name: z.string().optional().describe('New name for the contact'),
        email: z.string().email().optional().describe('New primary email address'),
        phone: z.string().optional().describe('New primary phone number'),
        mobile: z.string().optional().describe('New mobile number'),
        twitter_id: z.string().optional().describe('New Twitter handle'),
        address: z.string().optional().describe('New address'),
        company_id: z.number().int().positive().optional().describe('New company ID'),
        description: z.string().optional().describe('New description'),
        job_title: z.string().optional().describe('New job title'),
        language: z.string().optional().describe('New language'),
        tags: z.array(z.string()).optional().describe('New array of tags (replaces existing)'),
        time_zone: z.string().optional().describe('New time zone'),
        custom_fields: z.record(z.any()).optional().describe('New custom fields (merges/overwrites)'),
        other_emails: z.array(z.string().email()).optional().describe('New array of other emails (replaces existing)')
    },
    async (input: UpdateContactInput) => {
        const { contact_id, ...payload } = input;
        if (Object.keys(payload).length === 0) {
            return {
                content: [{ type: 'text', text: 'Validation Error: At least one field must be provided to update.' }],
                isError: true
            };
        }
        try {
            const updatedContact = await freshdesk.updateContact(contact_id, payload);
            return {
                content: [{ type: 'text', text: JSON.stringify(updatedContact, null, 2) }]
            };
        } catch (error) {
            console.error(`Error updating contact ${contact_id}:`, error);
            return {
                content: [{ type: 'text', text: `Error updating contact ${contact_id}: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Tool to search contacts (autocomplete)
server.tool(
    'search-contacts',
    'Search for contacts (autocomplete)',
    {
        query: z.string().describe('Search term (name, email, phone, etc.)')
    },
    async ({ query }: { query: string }) => {
        try {
            const results = await freshdesk.searchContacts(query);
            return {
                content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
            };
        } catch (error) {
            console.error('Error searching contacts:', error);
            return {
                content: [{ type: 'text', text: `Error searching contacts: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);


// --- Contact Field Tools ---

// Tool to list contact fields
server.tool(
    'list-contact-fields',
    'Retrieve all available contact fields',
    {},
    async () => {
        try {
            const fields = await freshdesk.listContactFields();
            return {
                content: [{ type: 'text', text: JSON.stringify(fields, null, 2) }]
            };
        } catch (error) {
            console.error('Error listing contact fields:', error);
            return {
                content: [{ type: 'text', text: `Error listing contact fields: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Tool to view a specific contact field
server.tool(
    'view-contact-field',
    'Retrieve details of a specific contact field by its ID',
    {
        field_id: z.number().int().positive().describe('The ID of the contact field to retrieve')
    },
    async ({ field_id }: { field_id: number }) => {
        try {
            const field = await freshdesk.viewContactField(field_id);
            return {
                content: [{ type: 'text', text: JSON.stringify(field, null, 2) }]
            };
        } catch (error) {
            console.error(`Error viewing contact field ${field_id}:`, error);
            return {
                content: [{ type: 'text', text: `Error viewing contact field ${field_id}: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Define input type for create-contact-field
type CreateContactFieldInput = FreshdeskContactFieldCreatePayload;

// Tool to create a contact field
server.tool(
    'create-contact-field',
    'Create a new custom contact field',
    {
        label: z.string().describe('Display label for the field (for agents)'),
        type: z.string().describe('Type of the field (e.g., custom_text, custom_dropdown)'),
        label_for_customers: z.string().optional().describe('Display label for customers'),
        required_for_agents: z.boolean().optional().describe('Whether mandatory for agents'),
        required_for_customers: z.boolean().optional().describe('Whether mandatory for customers'),
        displayed_for_customers: z.boolean().optional().describe('Whether displayed to customers'),
        editable_in_signup: z.boolean().optional().describe('Whether editable during signup'),
        customers_can_edit: z.boolean().optional().describe('Whether customers can edit'),
        position: z.number().int().positive().optional().describe('Position in the form'),
        choices: z.array(z.any()).optional().describe('Choices for dropdown fields')
    },
    async (input: CreateContactFieldInput) => {
        if (input.type === 'custom_dropdown' && (!input.choices || input.choices.length === 0)) {
             return {
                 content: [{ type: 'text', text: 'Validation Error: Choices are required for dropdown fields.' }],
                 isError: true
             };
        }
        try {
            const newField = await freshdesk.createContactField(input);
            return {
                content: [{ type: 'text', text: JSON.stringify(newField, null, 2) }]
            };
        } catch (error) {
            console.error('Error creating contact field:', error);
            return {
                content: [{ type: 'text', text: `Error creating contact field: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    }
);

// Define input type for update-contact-field
type UpdateContactFieldInput = { field_id: number } & FreshdeskContactFieldUpdatePayload;

// Tool to update a contact field
server.tool(
    'update-contact-field',
    'Update an existing custom contact field',
    {
        field_id: z.number().int().positive().describe('The ID of the contact field to update'),
        label: z.string().optional().describe('New display label (for agents)'),
        label_for_customers: z.string().optional().describe('New display label (for customers)'),
        required_for_agents: z.boolean().optional().describe('New value for mandatory for agents'),
        required_for_customers: z.boolean().optional().describe('New value for mandatory for customers'),
        displayed_for_customers: z.boolean().optional().describe('New value for displayed to customers'),
        editable_in_signup: z.boolean().optional().describe('New value for editable during signup'),
        customers_can_edit: z.boolean().optional().describe('New value for whether customers can edit'),
        position: z.number().int().positive().optional().describe('New position in the form'),
        choices: z.array(z.any()).optional().describe('New array of choices for dropdown fields')
    },
    async (input: UpdateContactFieldInput) => {
        const { field_id, ...payload } = input;
        if (Object.keys(payload).length === 0) {
            return {
                content: [{ type: 'text', text: 'Validation Error: At least one field must be provided to update.' }],
                isError: true
            };
        }
        try {
            const updatedField = await freshdesk.updateContactField(field_id, payload);
            return {
                content: [{ type: 'text', text: JSON.stringify(updatedField, null, 2) }]
            };
        } catch (error) {
            console.error(`Error updating contact field ${field_id}:`, error);
            return {
                content: [{ type: 'text', text: `Error updating contact field ${field_id}: ${error instanceof Error ? error.message : String(error)}` }],
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
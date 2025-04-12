import {
  FreshdeskArticle,
  FreshdeskArticlesResponse,
  FreshdeskCategoriesResponse,
  FreshdeskCategory,
  FreshdeskErrorResponse,
  FreshdeskFolder,
  FreshdeskFoldersResponse,
  FreshdeskSearchResponse, // This is for Solution search
  // Import Ticket related types
  FreshdeskTicket,
  FreshdeskTicketCreatePayload,
  FreshdeskTicketUpdatePayload,
  FreshdeskTicketsResponse,
  FreshdeskTicketSearchResponse,
  // Import Conversation/Note/Reply types
  FreshdeskConversation,
  FreshdeskConversationsResponse,
  FreshdeskReplyPayload,
  FreshdeskNotePayload,
  // Import Ticket Field types
  FreshdeskTicketField,
  FreshdeskTicketFieldsResponse,
  FreshdeskTicketFieldCreatePayload,
  FreshdeskTicketFieldUpdatePayload,
  // Import Contact types
  FreshdeskContact,
  FreshdeskContactsResponse,
  FreshdeskContactCreatePayload,
  FreshdeskContactUpdatePayload,
  FreshdeskContactSearchResponse,
  FreshdeskPaginatedContactsResponse,
  // Import Contact Field types
  FreshdeskContactField,
  FreshdeskContactFieldsResponse,
  FreshdeskContactFieldCreatePayload,
  FreshdeskContactFieldUpdatePayload,
  // Import Pagination types
  PaginationInfo,
  FreshdeskPaginatedTicketsResponse,
  FreshdeskTicketFilters,
} from './types.js';
import { URLSearchParams } from 'url'; // Needed for URLSearchParams

// Helper function to parse the Link header for pagination
function parseLinkHeader(linkHeader: string | null): PaginationInfo {
  const pagination: PaginationInfo = {};
  if (!linkHeader) {
    return pagination;
  }

  const links = linkHeader.split(',');
  const regex = /<(.+?)>;\s*rel="(.+?)"/;

  links.forEach(link => {
    const match = link.match(regex);
    if (match) {
      const url = match[1];
      const rel = match[2];
      try {
        const urlParams = new URLSearchParams(new URL(url).search);
        const page = urlParams.get('page');
        if (page && (rel === 'next' || rel === 'prev')) {
          const pageNum = parseInt(page, 10);
          if (!isNaN(pageNum)) {
            if (rel === 'next') {
              pagination.nextPage = pageNum;
            } else if (rel === 'prev') {
              pagination.prevPage = pageNum;
            }
          }
        }
      } catch (e) {
        console.error(`Error parsing URL from Link header: ${url}`, e);
      }
    }
  });

  return pagination;
}


export class FreshdeskAPI {
  private apiKey: string;
  private domain: string;
  private baseUrl: string;

  constructor(apiKey: string, domain: string) {
    this.apiKey = apiKey;
    this.domain = domain;
    this.baseUrl = `https://${domain}/api/v2`;
  }

  // Updated request method to return the full Response object
  private async requestRaw(endpoint: string, options: RequestInit = {}): Promise<Response> {
      const url = `${this.baseUrl}${endpoint}`;
      const auth = Buffer.from(`${this.apiKey}:X`).toString('base64');

      const response = await fetch(url, {
          ...options,
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${auth}`,
              ...options.headers,
          },
      });

      // Don't throw error here yet, let the caller decide based on status and body
      return response;
  }


  // Keep the original request method for convenience when only body is needed
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await this.requestRaw(endpoint, options);

    // Handle potential 204 No Content response
    if (response.status === 204) {
      return {} as T;
    }

    let data: T | FreshdeskErrorResponse | null = null;
    try {
        data = await response.json();
    } catch (e) {
        if (!response.ok) {
            throw new Error(`Freshdesk API Error (${response.status}): ${response.statusText}. Failed to parse response body.`);
        }
         return {} as T; // Or handle empty body for OK response differently
    }

    if (!response.ok) {
      const errorData = data as FreshdeskErrorResponse;
      const validationErrors = errorData?.errors ? ` Details: ${JSON.stringify(errorData.errors)}` : '';
      throw new Error(`Freshdesk API Error (${response.status}): ${errorData?.message || response.statusText}${validationErrors}`);
    }

    return data as T;
  }

  // --- Solution Methods ---

  async getCategories(): Promise<FreshdeskCategory[]> {
    try {
      const response = await this.request<FreshdeskCategoriesResponse>('/solutions/categories');
      if (!response || !Array.isArray(response)) {
        console.error('Invalid categories response:', response);
        return [];
      }
      return response;
    } catch (error) {
      console.error('Error in getCategories:', error);
      return [];
    }
   }
  async getFolders(categoryId: number): Promise<FreshdeskFolder[]> {
    const response = await this.request<FreshdeskFolder[]>(`/solutions/categories/${categoryId}/folders`);
    return response;
   }
  async getArticles(folderID: number): Promise<FreshdeskArticle[]> {
    const response = await this.request<FreshdeskArticle[]>(`/solutions/folders/${folderID}/articles`);
    return response;
   }
  async getArticle(articleId: number): Promise<FreshdeskArticle> {
    return this.request<FreshdeskArticle>(`/solutions/articles/${articleId}`);
   }
  async searchArticles(query: string): Promise<FreshdeskSearchResponse> {
    // Note: This searches Solutions, not Tickets
    return this.request<FreshdeskSearchResponse>(`/search/solutions?term=${encodeURIComponent(query)}`);
   }
  async getAllArticles(): Promise<FreshdeskArticle[]> {
    const categories = await this.getCategories();
    const allArticles: FreshdeskArticle[] = [];
    for (const category of categories) {
      const folders = await this.getFolders(category.id);
      for (const folder of folders) {
        try {
            const articles = await this.getArticles(folder.id);
            allArticles.push(...articles);
        } catch (error) {
            console.error(`Error fetching articles for folder ${folder.id}:`, error);
        }
      }
    }
    return allArticles;
   }

  // --- Ticket Methods ---

  async createTicket(payload: FreshdeskTicketCreatePayload): Promise<FreshdeskTicket> {
    return this.request<FreshdeskTicket>('/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
   }
  async getTicket(ticketId: number): Promise<FreshdeskTicket> {
    return this.request<FreshdeskTicket>(`/tickets/${ticketId}`);
   }
  async updateTicket(ticketId: number, payload: FreshdeskTicketUpdatePayload): Promise<FreshdeskTicket> {
    if (Object.keys(payload).length === 0) {
        throw new Error("Update payload cannot be empty.");
    }
    return this.request<FreshdeskTicket>(`/tickets/${ticketId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
   }
  async deleteTicket(ticketId: number): Promise<void> {
    await this.request<Record<string, never>>(`/tickets/${ticketId}`, {
      method: 'DELETE',
    });
   }
  async listTickets(
    page: number = 1,
    perPage: number = 30,
    filters?: FreshdeskTicketFilters
  ): Promise<FreshdeskPaginatedTicketsResponse> {
    const validPage = Math.max(1, page);
    const validPerPage = Math.min(Math.max(1, perPage), 100);
    
    const params = new URLSearchParams({
      page: validPage.toString(),
      per_page: validPerPage.toString(),
    });

    // Add filter parameters if provided
    if (filters) {
      if (filters.email) params.append('email', filters.email);
      if (filters.requester_id) params.append('requester_id', filters.requester_id.toString());
      if (filters.company_id) params.append('company_id', filters.company_id.toString());
      if (filters.status) params.append('status', filters.status.toString());
      if (filters.priority) params.append('priority', filters.priority.toString());
      if (filters.source) params.append('source', filters.source.toString());
      if (filters.group_id) params.append('group_id', filters.group_id.toString());
      if (filters.agent_id) params.append('agent_id', filters.agent_id.toString());
      if (filters.tags) params.append('tags', filters.tags.join(','));
      if (filters.created_since) params.append('created_since', filters.created_since);
      if (filters.updated_since) params.append('updated_since', filters.updated_since);
      if (filters.due_since) params.append('due_since', filters.due_since);
      
      // Handle custom fields
      if (filters.custom_fields) {
        Object.entries(filters.custom_fields).forEach(([key, value]) => {
          params.append(`custom_fields[${key}]`, value.toString());
        });
      }
    }

    const endpoint = `/tickets?${params.toString()}`;
    const response = await this.requestRaw(endpoint);
    if (!response.ok) {
        let errorData: FreshdeskErrorResponse | null = null;
        try { errorData = await response.json(); } catch (e) {}
        const validationErrors = errorData?.errors ? ` Details: ${JSON.stringify(errorData.errors)}` : '';
        throw new Error(`Freshdesk API Error (${response.status}): ${errorData?.message || response.statusText}${validationErrors}`);
    }
    const tickets = await response.json() as FreshdeskTicketsResponse;
    const linkHeader = response.headers.get('Link');
    const paginationInfo = parseLinkHeader(linkHeader);
    return {
      tickets: tickets,
      pagination: {
        currentPage: validPage,
        perPage: validPerPage,
        nextPage: paginationInfo.nextPage,
        prevPage: paginationInfo.prevPage,
      },
    };
  }
  async searchTickets(query: string): Promise<FreshdeskTicketSearchResponse> {
    const encodedQuery = encodeURIComponent(query);
    const endpoint = `/search/tickets?query="${encodedQuery}"`;
    return this.request<FreshdeskTicketSearchResponse>(endpoint);
   }
  async getTicketConversation(ticketId: number): Promise<FreshdeskConversationsResponse> {
    return this.request<FreshdeskConversationsResponse>(`/tickets/${ticketId}/conversations`);
   }
  async createTicketReply(ticketId: number, payload: FreshdeskReplyPayload): Promise<FreshdeskConversation> {
    return this.request<FreshdeskConversation>(`/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
   }
  async createTicketNote(ticketId: number, payload: FreshdeskNotePayload): Promise<FreshdeskConversation> {
    return this.request<FreshdeskConversation>(`/tickets/${ticketId}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
   }

  // --- Ticket Field Methods ---

  async getTicketFields(): Promise<FreshdeskTicketFieldsResponse> {
    return this.request<FreshdeskTicketFieldsResponse>('/ticket_fields');
  }
  async viewTicketField(fieldId: number): Promise<FreshdeskTicketField> {
    return this.request<FreshdeskTicketField>(`/ticket_fields/${fieldId}`);
  }
  async createTicketField(payload: FreshdeskTicketFieldCreatePayload): Promise<FreshdeskTicketField> {
    return this.request<FreshdeskTicketField>('/ticket_fields', {
      method: 'POST',
      body: JSON.stringify({ ticket_field: payload }),
    });
  }
  async updateTicketField(fieldId: number, payload: FreshdeskTicketFieldUpdatePayload): Promise<FreshdeskTicketField> {
    if (Object.keys(payload).length === 0) {
        throw new Error("Update payload cannot be empty.");
    }
    return this.request<FreshdeskTicketField>(`/ticket_fields/${fieldId}`, {
      method: 'PUT',
      body: JSON.stringify({ ticket_field: payload }),
    });
  }

  // --- Contact Methods ---

  async listContacts(page: number = 1, perPage: number = 30): Promise<FreshdeskPaginatedContactsResponse> {
      const validPage = Math.max(1, page);
      const validPerPage = Math.min(Math.max(1, perPage), 100);
      const params = new URLSearchParams({
          page: validPage.toString(),
          per_page: validPerPage.toString(),
      });
      const endpoint = `/contacts?${params.toString()}`;
      const response = await this.requestRaw(endpoint);

      if (!response.ok) {
          let errorData: FreshdeskErrorResponse | null = null;
          try { errorData = await response.json(); } catch (e) {}
          const validationErrors = errorData?.errors ? ` Details: ${JSON.stringify(errorData.errors)}` : '';
          throw new Error(`Freshdesk API Error (${response.status}): ${errorData?.message || response.statusText}${validationErrors}`);
      }

      const contacts = await response.json() as FreshdeskContactsResponse; // API returns array directly
      const linkHeader = response.headers.get('Link');
      const paginationInfo = parseLinkHeader(linkHeader);

      return {
          contacts: contacts,
          pagination: {
              currentPage: validPage,
              perPage: validPerPage,
              nextPage: paginationInfo.nextPage,
              prevPage: paginationInfo.prevPage,
          },
      };
  }
  async getContact(contactId: number): Promise<FreshdeskContact> {
      return this.request<FreshdeskContact>(`/contacts/${contactId}`);
  }
  async createContact(payload: FreshdeskContactCreatePayload): Promise<FreshdeskContact> {
      return this.request<FreshdeskContact>('/contacts', {
          method: 'POST',
          body: JSON.stringify(payload),
      });
  }
  async updateContact(contactId: number, payload: FreshdeskContactUpdatePayload): Promise<FreshdeskContact> {
      if (Object.keys(payload).length === 0) {
          throw new Error("Update payload cannot be empty.");
      }
      return this.request<FreshdeskContact>(`/contacts/${contactId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
      });
  }
   async searchContacts(query: string): Promise<FreshdeskContactSearchResponse> {
       const encodedQuery = encodeURIComponent(query);
       const endpoint = `/contacts/autocomplete?term=${encodedQuery}`;
       return this.request<FreshdeskContactSearchResponse>(endpoint);
   }

  // --- Contact Field Methods ---

  async listContactFields(): Promise<FreshdeskContactFieldsResponse> {
      return this.request<FreshdeskContactFieldsResponse>('/contact_fields');
  }
  async viewContactField(fieldId: number): Promise<FreshdeskContactField> {
      return this.request<FreshdeskContactField>(`/contact_fields/${fieldId}`);
  }
  async createContactField(payload: FreshdeskContactFieldCreatePayload): Promise<FreshdeskContactField> {
      return this.request<FreshdeskContactField>('/contact_fields', {
          method: 'POST',
          body: JSON.stringify({ contact_field: payload }),
      });
  }
  async updateContactField(fieldId: number, payload: FreshdeskContactFieldUpdatePayload): Promise<FreshdeskContactField> {
      if (Object.keys(payload).length === 0) {
          throw new Error("Update payload cannot be empty.");
      }
      return this.request<FreshdeskContactField>(`/contact_fields/${fieldId}`, {
          method: 'PUT',
          body: JSON.stringify({ contact_field: payload }),
      });
  }

  // Add other methods here (Agents, Groups, etc.) based on the plan.

}
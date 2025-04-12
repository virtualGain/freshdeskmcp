// Freshdesk Solution Category
export interface FreshdeskCategory {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// Freshdesk Solution Folder
export interface FreshdeskFolder {
  id: number;
  name: string;
  description: string;
  visibility: string; // Consider using an enum if specific values are known
  category_id: number;
  created_at: string;
  updated_at: string;
}

// Freshdesk Solution Article
export interface FreshdeskArticle {
  id: number;
  title: string;
  description: string;
  description_text: string;
  status: number; // Consider using an enum (Draft, Published)
  folder_id: number;
  category_id: number;
  agent_id: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
  impacts?: string[];
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string[];
  };
}

// Freshdesk API Response for Categories
// The API actually returns an array of categories directly, not an object with a categories property
export type FreshdeskCategoriesResponse = FreshdeskCategory[];

// Freshdesk API Response for Folders
export interface FreshdeskFoldersResponse {
  folders: FreshdeskFolder[];
}

// Freshdesk API Response for Articles
export interface FreshdeskArticlesResponse {
  articles: FreshdeskArticle[];
}

// Freshdesk API Response for Search (Solutions)
export interface FreshdeskSearchResponse {
  results: FreshdeskArticle[];
  total: number;
}

// Error response from Freshdesk API
export interface FreshdeskErrorResponse {
  code: string;
  message: string;
  errors?: Record<string, string[]>; // Field-specific validation errors
}

// --- Ticket Related Types ---

export enum TicketSource {
  EMAIL = 1,
  PORTAL = 2,
  PHONE = 3,
  CHAT = 7,
  FEEDBACK_WIDGET = 9,
  OUTBOUND_EMAIL = 10,
}

export enum TicketStatus {
  OPEN = 2,
  PENDING = 3,
  RESOLVED = 4,
  CLOSED = 5,
}

export enum TicketPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  URGENT = 4,
}

// Basic Freshdesk Ticket structure
export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  requester_id?: number; // ID of the contact who raised the ticket
  responder_id?: number; // ID of the agent to whom the ticket is assigned
  group_id?: number; // ID of the group to which the ticket is assigned
  email?: string; // Email address of the requester (if no requester_id)
  name?: string; // Name of the requester (if no requester_id)
  phone?: string; // Phone number of the requester
  twitter_id?: string; // Twitter handle of the requester
  facebook_id?: string; // Facebook ID of the requester
  company_id?: number; // ID of the company associated with the requester
  created_at: string;
  updated_at: string;
  due_by: string;
  fr_due_by: string; // First Response Due By timestamp
  is_escalated: boolean;
  fr_escalated: boolean; // First Response Escalated flag
  tags?: string[];
  custom_fields?: Record<string, any>; // Custom fields associated with the ticket
  // Add other fields as needed based on API documentation (e.g., attachments, conversations)
}

// Freshdesk Ticket Field structure
export interface FreshdeskTicketField {
  id: number;
  name: string; // Internal name (e.g., "cf_order_id")
  label: string; // Display label for agents
  description: string;
  position: number;
  required_for_closure: boolean;
  required_for_agents: boolean;
  type: string; // e.g., "custom_text", "custom_dropdown", "default_status"
  default: boolean; // Is it a default field?
  customers_can_edit: boolean;
  label_for_customers: string; // Display label for customers
  required_for_customers: boolean;
  displayed_for_customers: boolean;
  choices?: any[]; // For dropdown fields
  created_at: string;
  updated_at: string;
  // Add other potential fields based on API
}

// Response type for listing tickets (often an array)
export type FreshdeskTicketsResponse = FreshdeskTicket[];

// Response type for listing ticket fields
export type FreshdeskTicketFieldsResponse = FreshdeskTicketField[];

// Response type for ticket search
export interface FreshdeskTicketSearchResponse {
  results: FreshdeskTicket[];
  total: number;
}

// Structure for creating a ticket
export interface FreshdeskTicketCreatePayload {
  // Required fields
  subject: string;
  description: string;
  
  // Status, priority, and source (using numbers instead of enums for clarity)
  status: number; // Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed
  priority: number; // Priority: 1=Low, 2=Medium, 3=High, 4=Urgent
  source: number; // Source: 1=Email, 2=Portal, 3=Phone, 7=Chat, 9=Feedback Widget, 10=Outbound Email
  
  // Requester identification (at least one is required)
  email?: string;
  requester_id?: number;
  facebook_id?: string;
  phone?: string;
  twitter_id?: string;
  unique_external_id?: string;
  name?: string;
  
  // Optional fields
  type?: string;
  responder_id?: number;
  cc_emails?: string[];
  custom_fields?: Record<string, any>;
  due_by?: string; // ISO date format
  email_config_id?: number;
  fr_due_by?: string; // ISO date format
  group_id?: number;
  parent_id?: number;
  product_id?: number;
  tags?: string[];
  company_id?: number;
  internal_agent_id?: number;
  internal_group_id?: number;
  lookup_parameter?: string;
  // attachments field omitted as it requires special handling
}

// Structure for updating a ticket
export interface FreshdeskTicketUpdatePayload {
  // Optional fields that can be updated
  subject?: string;
  description?: string;
  
  // Status, priority, and source (using numbers instead of enums for clarity)
  status?: number; // Status: 2=Open, 3=Pending, 4=Resolved, 5=Closed
  priority?: number; // Priority: 1=Low, 2=Medium, 3=High, 4=Urgent
  source?: number; // Source: 1=Email, 2=Portal, 3=Phone, 7=Chat, 9=Feedback Widget, 10=Outbound Email
  
  // Requester identification
  email?: string;
  requester_id?: number;
  facebook_id?: string;
  phone?: string;
  twitter_id?: string;
  unique_external_id?: string;
  name?: string;
  
  // Other fields
  type?: string;
  responder_id?: number;
  custom_fields?: Record<string, any>;
  due_by?: string; // ISO date format
  email_config_id?: number;
  fr_due_by?: string; // ISO date format
  group_id?: number;
  parent_id?: number;
  product_id?: number;
  tags?: string[];
  company_id?: number;
  internal_agent_id?: number;
  internal_group_id?: number;
  lookup_parameter?: string;
  // attachments field omitted as it requires special handling
}

// Structure for pagination info parsed from Link header
export interface PaginationInfo {
  nextPage?: number;
  prevPage?: number;
}

// Structure for the response of listTickets method
export interface FreshdeskPaginatedTicketsResponse {
  tickets: FreshdeskTicket[];
  pagination: {
    currentPage: number;
    perPage: number;
    nextPage?: number;
    prevPage?: number;
  };
}

// --- Conversation/Note/Reply Types ---

// Structure for a single conversation item (reply, note, etc.)
export interface FreshdeskConversation {
    id: number;
    body: string; // HTML content
    body_text: string; // Plain text content
    incoming: boolean; // True if the conversation is from the customer
    private: boolean; // True if it's a private note
    user_id: number; // ID of the user (agent or contact) who created the conversation
    support_email?: string; // Email address from which the reply was sent
    ticket_id: number;
    created_at: string;
    updated_at: string;
    // Add other fields like attachments, source, cc_emails, bcc_emails as needed
}

// Response type for listing conversations (array of conversation items)
export type FreshdeskConversationsResponse = FreshdeskConversation[];

// Structure for creating a ticket reply
export interface FreshdeskReplyPayload {
    body: string; // HTML content of the reply
    user_id?: number; // Optional: Agent ID sending the reply (defaults to API key owner)
    cc_emails?: string[];
    bcc_emails?: string[];
    // Add attachments if needed
}

// Structure for creating a ticket note
export interface FreshdeskNotePayload {
    body: string; // HTML content of the note
    private?: boolean; // Default is true (private note)
    user_id?: number; // Optional: Agent ID creating the note (defaults to API key owner)
    // Add attachments if needed
}

// --- Ticket Field Types ---

// Structure for creating a ticket field
export interface FreshdeskTicketFieldCreatePayload {
    label: string;
    type: string; // e.g., "custom_text", "custom_dropdown"
    description?: string;
    position?: number;
    required_for_closure?: boolean;
    required_for_agents?: boolean;
    customers_can_edit?: boolean;
    label_for_customers?: string;
    required_for_customers?: boolean;
    displayed_for_customers?: boolean;
    choices?: any[]; // Required for dropdown type
}

// Structure for updating a ticket field
// Note: 'name' and 'type' cannot be updated via API
export interface FreshdeskTicketFieldUpdatePayload {
    label?: string;
    description?: string;
    position?: number;
    required_for_closure?: boolean;
    required_for_agents?: boolean;
    customers_can_edit?: boolean;
    label_for_customers?: string;
    required_for_customers?: boolean;
    displayed_for_customers?: boolean;
    choices?: any[]; // For dropdown type
}

// --- Contact Types ---

// Basic Freshdesk Contact structure
export interface FreshdeskContact {
    id: number;
    active: boolean;
    address?: string;
    company_id?: number;
    view_all_tickets: boolean; // Access permissions
    deleted: boolean;
    description?: string;
    email?: string;
    job_title?: string;
    language?: string; // e.g., "en"
    mobile?: string;
    name: string;
    phone?: string;
    time_zone?: string; // e.g., "Eastern Time (US & Canada)"
    twitter_id?: string;
    custom_fields?: Record<string, any>;
    tags?: string[];
    other_emails?: string[];
    created_at: string;
    updated_at: string;
    // other_companies?: any[]; // Structure depends on API response
}

// Response type for listing contacts (array)
export type FreshdeskContactsResponse = FreshdeskContact[];

// Structure for creating a contact
export interface FreshdeskContactCreatePayload {
    name: string;
    email?: string;
    phone?: string;
    mobile?: string;
    twitter_id?: string;
    unique_external_id?: string; // For identifying contacts uniquely
    address?: string;
    company_id?: number;
    description?: string;
    job_title?: string;
    language?: string;
    tags?: string[];
    time_zone?: string;
    custom_fields?: Record<string, any>;
    other_emails?: string[];
}

// Structure for updating a contact
export interface FreshdeskContactUpdatePayload {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    twitter_id?: string;
    address?: string;
    company_id?: number;
    description?: string;
    job_title?: string;
    language?: string;
    tags?: string[]; // Note: This replaces existing tags
    time_zone?: string;
    custom_fields?: Record<string, any>;
    other_emails?: string[]; // Note: This replaces existing other emails
}

// Structure for Contact Field (similar to Ticket Field but for contacts)
export interface FreshdeskContactField {
    id: number;
    name: string; // Internal name
    label: string; // Display label for agents
    label_for_customers: string; // Display label for customers
    type: string; // e.g., "custom_text", "custom_checkbox"
    required_for_agents: boolean;
    required_for_customers: boolean;
    displayed_for_customers: boolean;
    editable_in_signup: boolean;
    customers_can_edit: boolean;
    position: number;
    default_field: boolean;
    choices?: any[]; // For dropdown
    created_at: string;
    updated_at: string;
}

// Response type for listing contact fields
export type FreshdeskContactFieldsResponse = FreshdeskContactField[];

// Structure for creating a contact field
export interface FreshdeskContactFieldCreatePayload {
    label: string;
    type: string; // e.g., "custom_text", "custom_dropdown"
    label_for_customers?: string;
    required_for_agents?: boolean;
    required_for_customers?: boolean;
    displayed_for_customers?: boolean;
    editable_in_signup?: boolean;
    customers_can_edit?: boolean;
    position?: number;
    choices?: any[]; // Required for dropdown type
}

// Structure for updating a contact field
export interface FreshdeskContactFieldUpdatePayload {
    label?: string;
    label_for_customers?: string;
    required_for_agents?: boolean;
    required_for_customers?: boolean;
    displayed_for_customers?: boolean;
    editable_in_signup?: boolean;
    customers_can_edit?: boolean;
    position?: number;
    choices?: any[]; // For dropdown type
}

// Response type for contact search (autocomplete)
export interface FreshdeskContactSearchResponse {
    contacts: Pick<FreshdeskContact, 'id' | 'name' | 'email' | 'phone' | 'mobile'>[]; // Only includes basic fields
}

// Structure for paginated contacts response (if list contacts supports pagination)
export interface FreshdeskPaginatedContactsResponse {
  contacts: FreshdeskContact[];
  pagination: { // Assuming similar pagination structure
    currentPage: number;
    perPage: number;
    nextPage?: number;
    prevPage?: number;
  };
}

// Interface for ticket filters
export interface FreshdeskTicketFilters {
  // Direct filter parameters
  filter?: string;
  requester_id?: number;
  email?: string;
  unique_external_id?: string;
  company_id?: number;
  updated_since?: string;
  
  // Sorting parameters
  created_at?: 'asc' | 'desc';
  due_by?: 'asc' | 'desc';
  updated_at?: 'asc' | 'desc';
  status?: 'asc' | 'desc';
  
  // Lucene query parameter
  query?: string;
}
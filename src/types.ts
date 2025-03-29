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
  visibility: string;
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
  status: number;
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

// Freshdesk API Response for Search
export interface FreshdeskSearchResponse {
  results: FreshdeskArticle[];
  total: number;
}

// Error response from Freshdesk API
export interface FreshdeskErrorResponse {
  code: string;
  message: string;
  errors?: Record<string, string[]>;
}
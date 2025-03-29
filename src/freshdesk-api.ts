import {
  FreshdeskArticle,
  FreshdeskArticlesResponse,
  FreshdeskCategoriesResponse,
  FreshdeskCategory,
  FreshdeskErrorResponse,
  FreshdeskFolder,
  FreshdeskFoldersResponse,
  FreshdeskSearchResponse
} from './types.js';

export class FreshdeskAPI {
  private apiKey: string;
  private domain: string;
  private baseUrl: string;

  constructor(apiKey: string, domain: string) {
    this.apiKey = apiKey;
    this.domain = domain;
    this.baseUrl = `https://${domain}/api/v2`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

    const data = await response.json() as T | FreshdeskErrorResponse;
    
    if (!response.ok) {
      const errorData = data as FreshdeskErrorResponse;
      throw new Error(`Freshdesk API Error: ${errorData.message || response.statusText}`);
    }
    
    return data as T;
  }

  // Get all solution categories
  async getCategories(): Promise<FreshdeskCategory[]> {
    try {
      const response = await this.request<FreshdeskCategoriesResponse>('/solutions/categories');
      
      // Check if response is an array
      if (!response || !Array.isArray(response)) {
        console.error('Invalid categories response:', response);
        // Return an empty array instead of undefined or null
        return [];
      }
      
      return response;
    } catch (error) {
      console.error('Error in getCategories:', error);
      // Return an empty array on error
      return [];
    }
  }

  // Get folders in a category
  async getFolders(categoryId: number): Promise<FreshdeskFolder[]> {
    const response = await this.request<FreshdeskFoldersResponse>(`/solutions/categories/${categoryId}/folders`);
    return response.folders;
  }

  // Get articles in a folder
  async getArticles(folderID: number): Promise<FreshdeskArticle[]> {
    const response = await this.request<FreshdeskArticlesResponse>(`/solutions/folders/${folderID}/articles`);
    return response.articles;
  }

  // Get a specific article by ID
  async getArticle(articleId: number): Promise<FreshdeskArticle> {
    return this.request<FreshdeskArticle>(`/solutions/articles/${articleId}`);
  }

  // Search for articles
  async searchArticles(query: string): Promise<FreshdeskSearchResponse> {
    return this.request<FreshdeskSearchResponse>(`/search/solutions?term=${encodeURIComponent(query)}`);
  }

  // Get all articles across all categories and folders
  async getAllArticles(): Promise<FreshdeskArticle[]> {
    const categories = await this.getCategories();
    const allArticles: FreshdeskArticle[] = [];

    for (const category of categories) {
      const folders = await this.getFolders(category.id);
      
      for (const folder of folders) {
        const articles = await this.getArticles(folder.id);
        allArticles.push(...articles);
      }
    }

    return allArticles;
  }
}
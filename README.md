# Freshdesk MCP Server

An MCP (Model Context Protocol) server that connects to the Freshdesk API, allowing LLMs to retrieve and search solution articles.

## Features

- Retrieve all solution articles from Freshdesk
- Search for specific articles using the Freshdesk search API
- Browse categories and folders
- Get detailed article information

## Prerequisites

- Node.js 18 or higher
- Freshdesk account with API access
- Freshdesk API key

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on the `.env.example` file:

```bash
cp .env.example .env
```

4. Add your Freshdesk API key and domain to the `.env` file:

```
FD_KEY=your_freshdesk_api_key_here
FD_DOMAIN=your_freshdesk_domain_here
```

## Building

Build the TypeScript code:

```bash
npm run build
```

## Running

Start the MCP server:

```bash
npm start
```

## Using with Claude Desktop

To use this MCP server with Claude Desktop, add the following to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "freshdesk": {
      "command": "node",
      "args": ["/path/to/freshdeskmcp/build/index.js"],
      "env": {
        "FD_KEY": "your_freshdesk_api_key_here",
        "FD_DOMAIN": "your_freshdesk_domain_here"
      }
    }
  }
}
```

## Available Resources

- `freshdesk://articles` - Get all solution articles
- `freshdesk://article/{id}` - Get a specific article by ID

## Available Tools

- `search-articles` - Search for articles using a query string
- `get-categories` - Get all solution categories and their folders

## Development

For development, you can run the server in watch mode:

```bash
npm run dev
```

## License

MIT
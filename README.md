# Agent Browser OpenAPI Server

A production-grade, modular OpenAPI server for integrating [agent-browser](https://github.com/vercel-labs/agent-browser) with Open WebUI.

## ✨ Features

- 🔄 **Request Queuing** - Prevents concurrent browser conflicts
- 🧹 **Session Management** - Automatic cleanup and resource management
- 🔁 **Retry Mechanism** - Exponential backoff for failed requests
- ⏳ **Smart Waiting** - Network idle detection for proper page loads
- 🔒 **Safe Execution** - No shell injection vulnerabilities
- 📦 **Modular Architecture** - Clean, maintainable codebase
- 🎯 **Intelligent Search** - 10-step optimized search workflow with summaries

## 📋 Requirements

- Node.js 16+ (with ES modules support)
- `agent-browser` CLI installed globally

## 🚀 Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Install agent-browser globally:**
```bash
npm install -g agent-browser
```

## 🎮 Usage

### Start the server:
```bash
npm start
```

### Development mode (with auto-reload):
```bash
npm run dev
```

The server will start on `http://localhost:5000` (or the port specified in `PORT` environment variable).

## 📚 API Endpoints

### Health Check
```http
GET /health
```

Returns server status and queue length.

### OpenAPI Specification
```http
GET /openapi.json
```

Returns the complete OpenAPI specification.

### Intelligent Search
```http
POST /search
Content-Type: application/json

{
  "query": "Node.js best practices",
  "maxResults": 5
}
```

**Optimized 10-Step Workflow:**
1. Opens Google and searches with keywords
2. Intelligently waits for search results
3. Extracts search result links
4. Clicks the first link
5. Waits for page to fully load
6. Extracts page content
7. Checks if content is relevant to query
8. Repeats for subsequent links until max results
9. Generates summary of all results
10. Returns results with summary

**Response:**
```json
{
  "query": "Node.js best practices",
  "results": [
    {
      "title": "Node.js Best Practices",
      "url": "https://example.com/nodejs-best-practices",
      "snippet": "...",
      "relevance": "high",
      "contentLength": 15234
    }
  ],
  "totalFound": 10,
  "relevantCount": 5,
  "summary": "Search Summary for: \"Node.js best practices\"\nFound 5 relevant result(s):\n...",
  "timestamp": "2026-01-17T04:06:44.000Z",
  "duration": 12345
}
```

### Browse URL
```http
POST /browse
Content-Type: application/json

{
  "url": "https://example.com",
  "selector": "body",
  "extract": "text"
}
```

Extracts content from a URL. `extract` can be `"text"` or `"html"`.

### Screenshot
```http
POST /screenshot
Content-Type: application/json

{
  "url": "https://example.com"
}
```

Returns a base64-encoded screenshot of the URL.

## 🔧 Integration with Open WebUI

1. Start the server: `npm start`
2. In Open WebUI, go to **Workspace → Tools**
3. Click **"Import Tool"**
4. Enter the OpenAPI URL:
   - Local: `http://localhost:5000/openapi.json`
   - Docker: `http://host.docker.internal:5000/openapi.json`

## 🏗️ Project Structure

```
search-browser/
├── src/
│   ├── config/           # Configuration management
│   ├── core/             # Core functionality (queue, executor)
│   ├── services/         # Business logic (search, browse, screenshot)
│   ├── utils/            # Utility functions (validation, retry, parser)
│   ├── routes/           # HTTP endpoint handlers
│   ├── middleware/       # Express middleware
│   └── server.js         # Main server entry point
├── openapi.json          # OpenAPI specification
├── package.json
└── README.md
```

### Module Overview

- **config/** - Centralized configuration (ports, timeouts, retry settings)
- **core/RequestQueue.js** - Sequential request processing to prevent browser conflicts
- **core/AgentExecutor.js** - Safe execution of agent-browser commands
- **services/SearchService.js** - Intelligent search with 10-step workflow
- **services/BrowseService.js** - URL browsing and content extraction
- **services/ScreenshotService.js** - Screenshot capture functionality
- **utils/validation.js** - Input validation and sanitization
- **utils/retry.js** - Retry logic with exponential backoff
- **utils/session.js** - Session ID generation
- **utils/parser.js** - HTML/snapshot parsing and relevance checking
- **routes/** - Express route handlers for each endpoint
- **middleware/errorHandler.js** - Centralized error handling

## ⚙️ Configuration

Edit `src/config/index.js` to customize:

```javascript
export const config = {
    port: process.env.PORT || 5000,
    
    timeouts: {
        command: 30000,    // General command timeout
        open: 15000,       // Page open timeout
        wait: 20000,       // Page load wait timeout
        extract: 10000,    // Content extraction timeout
        screenshot: 10000, // Screenshot timeout
        close: 5000        // Session close timeout
    },
    
    retry: {
        maxAttempts: 3,    // Number of retry attempts
        baseDelay: 1000    // Base delay for exponential backoff
    },
    
    search: {
        defaultMaxResults: 5,      // Default max search results
        relevanceThreshold: 0.5,   // Relevance threshold (50%)
        minKeywordLength: 2        // Minimum keyword length
    }
};
```

## 🧪 Testing

### Test the health endpoint:
```bash
curl http://localhost:5000/health
```

### Test search:
```bash
curl -X POST http://localhost:5000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "OpenAI GPT", "maxResults": 3}'
```

### Test browse:
```bash
curl -X POST http://localhost:5000/browse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "selector": "body", "extract": "text"}'
```

## 🐛 Troubleshooting

### Server won't start
- Ensure Node.js 16+ is installed: `node --version`
- Check if port 5000 is available
- Verify `agent-browser` is installed: `agent-browser --version`

### Search returns no results
- Check internet connection
- Verify Google is accessible
- Check console logs for detailed error messages

### Browser sessions not closing
- Check console for session cleanup errors
- Restart the server to force cleanup

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! The modular architecture makes it easy to:
- Add new endpoints (create new route and service files)
- Extend functionality (add utilities or services)
- Improve existing features (modify specific modules)

## 📖 Documentation

See [walkthrough.md](./walkthrough.md) for detailed documentation on the refactoring process and architecture decisions.

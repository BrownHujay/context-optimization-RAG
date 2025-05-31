# Chat Thingy

A modern chat application with advanced RAG (Retrieval Augmented Generation) capabilities and a React-based frontend.

## Project Overview

Chat Thingy is a comprehensive chat application that combines:

- **Frontend**: React 19 with TypeScript, Tailwind CSS, and Three.js for animations
- **Backend**: Custom API with vector-based search and embedding capabilities
- **Retrieval System**: Advanced RAG with reranking and embedding for intelligent message retrieval
- **Database**: Local storage with planned MongoDB integration

## How It Works

The application uses a sophisticated retrieval system to find relevant information:

1. Messages are stored in a database and embedded using vector embeddings
2. When searching, the system uses similarity search to find relevant content
3. Results are reranked for better accuracy
4. The system supports both chat-specific and user-wide searches
5. Optional LLM integration for generating responses (configurable with local models or OpenAI API)

## Features

### Completed ✅

- Vector store for similarity-based retrieval
- Base backend API
- Local database for message storage
- Reranking and embedding system
- Testing framework
- Chat and user-wide search functionality

### In Progress 🔄

- MongoDB integration for improved data persistence
- Frontend API connectivity
- LLM integration (local or OpenAI)
- Frontend UI development

### Planned Optimizations

- Better logic for saving messages
- Improved embedding and retrieval performance
- API refinements for smoother frontend-backend communication

## Future Ideas

### Data Visualization

- Interactive graphs showing code language usage
- User activity statistics
- RAG retrieval quality metrics and visualization
- Similarity visualization between messages

### User Experience

- "Thinking..." animations when using models like DeepSeek
- Visibility into backend processing steps
- Rich text support including LaTeX, Markdown, and code blocks
- Model switching capabilities
- User authentication system

## Development Roadmap

### Immediate Tasks

- [ ] Setup MongoDB for persistent storage
- [ ] Complete frontend-backend API integration
- [ ] Implement LLM integration (local or OpenAI)
- [ ] Build out the frontend UI

### Nice-to-Haves

- [ ] Animated UI elements for processing indicators
- [ ] Backend process visualization
- [ ] Statistical dashboards
- [ ] Data visualization graphs
- [ ] User login system
- [ ] Model selection interface
- [ ] Rich text editor with LaTeX, Markdown, and code blocks
- [ ] Code usage analytics and visualization
- [ ] User data statistics and charts

## Updates

**5/31/25** - Completed reranking, embedding, and search functionality  
**5/30/25** - Initial setup with vector store and base API

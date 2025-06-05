# Context Optimization RAG

A modern chat application with advanced RAG (Retrieval Augmented Generation) capabilities and a React-based frontend.

## Project Overview

This project is a comprehensive chat application that combines:

- **Frontend**: React 19 with TypeScript, Tailwind CSS, and Three.js for graphing
- **Backend**: Custom API with vector-based search and embedding capabilities
- **Retrieval System**: Advanced RAG with reranking and embedding for intelligent message retrieval
- **Database**: Local storage with planned MongoDB integration

## How It Works

The application uses a hybrid retrieval system to find relevant information:

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
- Basic Frontend
- MongoDB integration for improved data persistence
- Frontend API connectivity
- LLM integration (local or OpenAI)
- Frontend UI development
- User authentication system (sorta)

### In Progress 🔄

- None right now

### Planned Optimizations

- Better logic for saving messages
- Improved embedding and retrieval performance
- API refinements for smoother frontend-backend communication
- Redo the DB and everything so that instead of saving in the fronend and causing hell, save in the backend so that even if the user close the site it'll keep running so when they reload they'll have their message
- Convert to vLLM when I run on my PC, that way it'll run faster and squeeze more performance out of my GPU. Build a system for the backend that'll recognize what's going on and optimize for that machine
- Actual password hashing and security, setup like a real webapp.
- Some form of node system, can my computer and PC trade off work together? run a much larger model over three different computers
- Convert to working webhooks for faster data transfer
- Remove all unused functions such as testing and legacy. Reorganize files into better folders. lots of backend files that are unuesd or uneeded

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
- Other functions, such as image generation, prompt editing, long term storage, memory managment

### Immediate Tasks

- [ ] Setup MongoDB for persistent storage
- [ ] Complete frontend-backend API integration
- [ ] Implement LLM integration (local or OpenAI)
- [ ] Build out the frontend UI
- [ ] Set up routes and react router routes
- [ ] Add navbar for actual settings
- [ ] Add routes to fix the chat page. Set up chat vs home page so that way I don't keep sending myself to dead links.

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

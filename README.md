# AI Shorts Factory 🎬

A comprehensive, evidence-first AI video production platform for creating factual movie shorts. Built with modern containerized architecture and hot reload development workflow.

## 🚀 Quick Start

### Development (Recommended)
```bash
# Setup environment
cp .env.example .env
# Edit .env with your API keys

# Run with Docker (includes PostgreSQL, Redis, hot reload)
docker compose up -d

# Access application
open http://localhost:3000
```

### Local Development (Alternative)
```bash
cp .env.example .env
npm install
npm run dev:hot  # With hot reload
# or
npm run dev     # Standard development
```

## 🏗️ Architecture Overview

### Modern Modular Design
- **Containerized**: Docker Compose with PostgreSQL, Redis, and hot reload
- **Microservice-Ready**: Clean service layer with dependency injection
- **Hot Reload**: Instant feedback for development changes (1-3 second cycle)
- **Production-Ready**: Separate development and production configurations

### Project Structure
```
├── server.js              # Main application entry point
├── lib/                    # Core infrastructure
│   ├── ai.js              # AI model integrations (OpenRouter)
│   ├── services.js        # Business logic services
│   ├── router.js          # HTTP routing with hot reload
│   ├── middleware.js      # Authentication & request handling
│   ├── hot-reload.js      # Development hot reload system
│   ├── database.js        # PostgreSQL integration
│   ├── queue.js           # Redis job processing
│   └── ...
├── routes/                # API endpoint handlers
│   ├── health.js          # System monitoring
│   ├── shorts.js          # Video production pipeline
│   ├── prompts.js         # Versioned prompt management
│   ├── budget.js          # Cost tracking
│   ├── youtube.js         # Publishing integration
│   └── batch.js           # Bulk processing
├── public/                # Frontend assets
└── docker-compose.yml     # Development environment
```

## 🛠️ Development Workflow

### Hot Reload Features
- **File Watching**: Monitors `/lib`, `/routes`, `/public` for changes
- **Server Restart**: Automatic Node.js restart on backend changes
- **Browser Updates**: Real-time frontend refresh via Server-Sent Events
- **CSS Hot Reload**: Style updates without page refresh
- **Debounced Changes**: Prevents reload storms during rapid edits

### Development Commands
```bash
# Start with hot reload
npm run dev:hot

# Standard development
npm run dev

# Production build
npm start

# Type checking
npm run build

# Code validation
npm run lint
```

## ⚙️ Configuration & Setup

### Required Environment Variables
```bash
# Core AI Configuration
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=qwen/qwen-2.5-72b-instruct
OPENROUTER_HELPER_MODEL=bytedance/seed-2.0-mini
OPENROUTER_IMAGE_MODEL=bytedance-seed/seedram-4.5

# Database & Queue (handled by Docker)
DATABASE_URL=postgresql://shorts_factory:shorts_factory@postgres:5432/shorts_factory
REDIS_URL=redis://redis:6379

# Optional Services
TTS_PROVIDER=none
TTS_API_KEY=your_tts_key_here
```

### System Health Check
Visit `/api/health` to verify all services:
- ✅ **OpenRouter**: AI model connectivity
- ✅ **Database**: PostgreSQL connection
- ✅ **Redis**: Job queue system
- ✅ **Music**: Library initialization (8 tracks)
- ✅ **FFmpeg**: Video rendering capabilities

## 📺 YouTube OAuth Setup

To enable YouTube publishing, you need to configure OAuth credentials:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Set application type to "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/youtube/callback`
   - For production, add your production domain's callback URL
5. Copy the Client ID and Client Secret to your `.env` file:
   ```
   YOUTUBE_CLIENT_ID=your_client_id_here
   YOUTUBE_CLIENT_SECRET=your_client_secret_here
   YOUTUBE_REDIRECT_URI=http://localhost:3000/api/youtube/callback
   ```
6. Restart the server

Once configured, the YouTube section will show:
- ✓ Connected status with channel name
- Channel subscriber count  
- Clear upload destination
- Channel ID for verification

**Important:** OAuth connects to the YouTube channel associated with the Google account that authorizes the app. The app will upload to whatever channel that Google account has access to - make sure to connect with the correct account.

## 🎵 AI Music Integration

The app supports both copyright-free music library and AI-generated music using Suno AI:

### **Music Library (Default)**
- Automatically downloads copyright-free tracks on startup
- Organized by mood: Dark/Cinematic, Epic/Action, Suspense, Emotional, Sci-fi, Mysterious
- No additional cost for library tracks

### **Suno AI Music Generation**
1. Get a Suno API key from [suno.ai](https://suno.ai)
2. Add to your `.env` file:
   ```
   AI_MUSIC_PROVIDER=suno
   SUNO_API_KEY=your_suno_api_key_here
   MUSIC_GENERATION_ENABLED=true
   ```
3. Restart the server

### **Music Features**
- **Mood Selection**: 6 different moods optimized for Marvel content
- **Context-Aware**: Music adapts to content (Avengers → heroic themes, Thor → mythological, etc.)
- **Preview System**: Listen to generated/selected music before rendering
- **Cost Tracking**: AI music generation costs are tracked in your budget
- **Fallback**: If AI generation fails, automatically falls back to library

### **Marvel-Optimized Prompts**
The AI music system includes Marvel-specific enhancements:
- **Character-specific**: Different musical elements for Iron Man, Thor, Spider-Man, etc.
- **Villain themes**: Specialized music for Thanos, Loki, Doctor Doom, etc.
- **Event-based**: Unique approaches for Civil War, Infinity War, Multiverse content
- **Intensity control**: From subtle background (30%) to maximum drama (95%)

Example AI generation:
```
Topic: "Avengers: Doomsday"
Mood: "Epic / Action" 
Result: "Powerful heroic orchestral arrangement with driving percussion, 
bold brass sections, and epic crescendos with heroic themes and ensemble 
motifs, 80% intensity, exactly 60 seconds duration."
```

## 🔒 Production Rules & Safety

- **Evidence before script:** facts must cite saved sources; confirmed claims need the configured minimum source count (two by default).
- **Evidence-bound writing:** the Vercel AI SDK sends the structured evidence package to OpenRouter and requires every script claim to cite fact IDs.
- **Two factuality gates:** deterministic citation checks run before a separate adversarial AI review. Either failure blocks QA and publishing.
- **Hard budget planning:** the default $20 / 450-Short plan keeps a $2 reserve and selects only the affordable 2–5 image plan.
- **Safe music handling:** reuse only commercially licensed library tracks; generated-music briefs reject named artist, composer, film, and soundtrack imitation references.
- **No fabricated completion:** unconfigured image, TTS, rendering, and YouTube adapters fail as retryable job states instead of pretending work completed.

## 🏛️ Technical Architecture

### Service Layer Design
- **StateManager**: Runtime data persistence with atomic operations
- **DatabaseService**: PostgreSQL with connection pooling
- **QueueService**: Redis-based job processing with BullMQ
- **PromptsService**: Versioned prompt template management
- **BudgetService**: Cost tracking with spending limits
- **ShortsService**: Complete video production pipeline
- **YouTubeService**: OAuth integration and publishing

### Container Orchestration
```yaml
services:
  app:         # Main application (port 3000)
  worker:      # Background job processor
  postgres:    # Database with health checks
  redis:       # Job queue and caching
```

### Hot Reload Implementation
- **File Watching**: Recursive monitoring with debouncing
- **SSE Broadcasting**: Real-time browser updates
- **Smart Reloading**: CSS without refresh, JS with reload
- **Development Optimization**: Docker volume mounts for instant sync

The application uses a modern Node.js HTTP server with modular routing. The AI boundary is implemented with the Vercel AI SDK plus OpenRouter's provider adapter, maintaining type safety and provider flexibility.

## 🔌 API Reference

### System Endpoints
- `GET /api/health` - System status and configuration check
- `GET /api/events` - Server-Sent Events for hot reload

### Content Management
- `GET|POST /api/shorts` - Video project management
- `POST /api/shorts/:id/research` - Evidence gathering
- `GET /api/shorts/:id/facts` - Fact verification
- `POST /api/shorts/:id/script` - Script generation
- `POST /api/shorts/:id/qa` - Quality assurance
- `POST /api/shorts/:id/scenes/:number/image` - Scene image generation
- `POST /api/shorts/:id/audio` - Voice generation
- `POST /api/shorts/:id/render` - Video rendering
- `POST /api/shorts/:id/publish` - YouTube publishing

### Configuration & Templates
- `GET|PATCH /api/budget` - Budget tracking and limits
- `GET /api/prompts` - Prompt template management
- `POST /api/prompts/:id/versions` - Version control
- `POST /api/batch` - Bulk processing

### YouTube Integration
- `GET /api/youtube/status` - Channel connection status
- `POST /api/youtube/connect` - OAuth initiation
- `GET /api/youtube/callback` - OAuth completion

## 🚢 Production Deployment

### Environment Configurations
```bash
# Development with hot reload
docker compose up -d

# Production deployment
docker compose -f docker-compose.prod.yml up -d
```

### Production Checklist
- [ ] Configure persistent PostgreSQL with backups
- [ ] Set up Redis persistence and clustering
- [ ] Add image generation provider (Replicate, etc.)
- [ ] Configure TTS provider (ElevenLabs, etc.)
- [ ] Set up FFmpeg with GPU acceleration
- [ ] Configure YouTube OAuth token storage
- [ ] Implement monitoring and alerting
- [ ] Set up log aggregation
- [ ] Configure SSL/TLS certificates
- [ ] Test all worker adapters

### Health Monitoring
The application provides comprehensive health checks at `/api/health`:
- Service connectivity status
- Configuration validation
- Resource availability
- Performance metrics

### Budget Management
- **Default**: $20 budget for 450 shorts ($0.044 per short)
- **Reserve**: $2 safety buffer maintained
- **Tracking**: Real-time cost monitoring
- **Limits**: Hard stops prevent overspending

## 🧪 Development & Testing

### Running Tests
```bash
npm test                # Run test suite
npm run lint           # Code quality checks
npm run build          # TypeScript validation
```

### Development Tools
- **Hot Reload**: File changes reflected in 1-3 seconds
- **Container Logs**: `docker compose logs -f app`
- **Database Access**: Connect to PostgreSQL on localhost:5432
- **Redis CLI**: `docker compose exec redis redis-cli`
- **Health Check**: `curl http://localhost:3000/api/health`

### Debugging
- Set `NODE_ENV=development` for verbose logging
- Use `docker compose logs app --tail=50` for recent logs
- Monitor file changes with hot reload system
- Check service health at `/api/health` endpoint

## 🔧 Troubleshooting

### Common Issues

**Hot Reload Not Working**
```bash
# Restart containers to refresh volume mounts
docker compose down && docker compose up -d
```

**Database Connection Errors**
```bash
# Wait for PostgreSQL health check
docker compose logs postgres
```

**Port Already in Use**
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
```

**Missing API Keys**
- Copy `.env.example` to `.env`
- Add required API keys
- Restart containers

## 📊 Monitoring & Observability

### Health Metrics
- **System Status**: Real-time service health
- **Budget Tracking**: Spending and limits
- **Queue Status**: Background job processing
- **Error Rates**: API endpoint monitoring

### Logging
- **Structured JSON**: Machine-readable logs
- **Service Labels**: Component identification
- **Error Context**: Detailed error information
- **Performance Metrics**: Request timing and resource usage

## 🤝 Contributing

### Code Style
- Follow existing modular patterns
- Add proper error handling
- Include structured logging
- Write comprehensive tests

### Architecture Guidelines
- Keep services loosely coupled
- Use dependency injection
- Maintain clear separation of concerns
- Follow container best practices

## 📄 License

[Your License Here]

---

**🚀 Ready to create AI-powered movie shorts with confidence!**

For additional documentation, see `ENGINEERING_REPORT.md` for detailed technical analysis.

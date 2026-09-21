# 🎵 HarmonyHub - Real-time Music Voting System

<div align="center">

![HarmonyHub](https://img.shields.io/badge/HarmonyHub-Music%20Voting-1DB954?style=for-the-badge&logo=spotify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)

**A production-ready, real-time music voting platform for parties and events**

[Features](#-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Deployment](#-deployment-aws-free-tier) • [API Docs](#-api-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Development](#-development)
- [Production Build](#-production-build)
- [Docker Deployment](#-docker-deployment)
- [AWS Deployment](#-deployment-aws-free-tier)
- [API Documentation](#-api-documentation)
- [Future Features](#-future-features)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 🎯 Overview

HarmonyHub is a scalable, real-time music voting system inspired by Spotify. Users can create rooms, add songs from Spotify, and vote for their favorites in real-time. Perfect for parties, events, and collaborative music sessions.

### 🎬 Demo Flow

1. **Admin** creates a room and gets a unique code
2. **Admin** searches and adds songs from Spotify
3. **Users** join using room code or QR code
4. **Users** vote for their favorite songs
5. **Everyone** sees real-time leaderboard updates via WebSocket

---

## ✨ Features

### Current Features

✅ **Room Management**
- Create unique rooms with auto-generated codes
- QR code for instant room joining
- 24-hour auto-expiry

✅ **Spotify Integration**
- Search songs from Spotify's massive library
- Display album art, artist info, and preview URLs
- Direct links to Spotify tracks

✅ **Real-time Voting**
- Socket.io powered instant updates
- Redis sorted sets for leaderboard
- Vote count persistence

✅ **Beautiful UI**
- Modern, responsive design
- Gradient animations
- Mobile-friendly interface
- Gold/Silver/Bronze rank badges

✅ **Production Ready**
- Docker containerization
- Error handling & validation
- CORS security
- Health check endpoints

### 🔮 Future Features (Extensible Architecture)

- 🎵 Spotify playback synchronization
- 💬 Real-time chat in rooms
- 📝 Queue management system
- 👥 User authentication
- 🤖 AI-powered song recommendations
- ⚖️ Weighted voting system
- 📧 Email/SMS invites

---

## 🛠 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **React Router** - Client-side routing
- **Socket.io Client** - Real-time communication
- **Lucide React** - Icon library
- **QRCode.react** - QR code generation

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Socket.io** - WebSocket server
- **Redis** - In-memory database for leaderboard
- **Axios** - HTTP client

### DevOps
- **Docker & Docker Compose** - Containerization
- **Nginx** - Frontend server
- **PM2** - Process management (production)
- **AWS EC2** - Hosting (free tier)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│                    Users                        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│          React Frontend (Vite)                  │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │   Home   │   Room   │  Admin   │Components│ │
│  └──────────┴──────────┴──────────┴──────────┘ │
└────────────────┬────────────────────────────────┘
                 │
     ┌───────────┴────────────┐
     │                        │
     ▼                        ▼
REST API              WebSocket (Socket.io)
     │                        │
     └───────────┬────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│       Node.js + Express Server                  │
│  ┌──────────┬──────────┬──────────────────────┐│
│  │Controllers│ Services │  Socket Handlers    ││
│  └──────────┴──────────┴──────────────────────┘│
└────────────────┬────────────────────────────────┘
                 │
     ┌───────────┴────────────┐
     │                        │
     ▼                        ▼
┌──────────┐          ┌──────────────┐
│  Redis   │          │ Spotify API  │
│Leaderboard│         │  (Search)    │
└──────────┘          └──────────────┘
```

### Data Flow

**Vote Flow:**
```
User clicks Vote → Socket.io → Redis ZINCRBY → Broadcast Update → All Clients Update UI
```

**Search Flow:**
```
Admin searches → REST API → Spotify API → Format & Return → Display Results
```

---

## 📦 Prerequisites

- Node.js 20+
- Docker Desktop (runs Postgres and Redis)
- Python 3.11+ (optional, AI playlists)
- Spotify app credentials and a Google Gemini API key

---

## 🚀 Quick Start

```bash
npm run setup            # install dependencies
cp .env.example .env     # then add Spotify + Gemini keys
npm run dev:deps         # Postgres + Redis in Docker
npm run db:migrate       # create the database schema
npm run dev              # backend :3000, frontend :5173, recommender :5001
```

Full guide: [docs/QUICKSTART.md](docs/QUICKSTART.md). Released versions are tagged. Run `git checkout v0.2.0` for a specific one, and see [CHANGELOG.md](CHANGELOG.md) for what each contains.

---

## ⚙️ Configuration

### Environment Variables

#### Root `.env` (backend, Prisma, docker compose, recommender)

All variables are documented in [`.env.example`](.env.example). The main ones:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Postgres connection string | `postgresql://harmonyhub:harmonyhub@localhost:5432/harmonyhub` | Yes |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Yes |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify app credentials | - | Yes |
| `GOOGLE_API_KEY` | Gemini key for AI playlists | - | For AI features |
| `PORT` | Backend port | `3000` | No |
| `FRONTEND_URL` | Where the app is opened; used for redirects after login | `http://127.0.0.1:5173` | No |
| `SPOTIFY_REDIRECT_URI` | Must match the Spotify dashboard exactly | `${FRONTEND_URL}/api/auth/spotify/callback` | No |
| `TOKEN_ENCRYPTION_KEY` | Encrypts Spotify refresh tokens; create with `npm run secrets` | - | For Spotify login |
| `CORS_ORIGIN` | Extra allowed origins, comma-separated | - | No |
| `ROOM_TTL_SECONDS` | Lifetime of a party room and its data | `86400` | No |

#### Frontend (`frontend/.env`, optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend that the Vite dev server proxies `/api` and `/socket.io` to | `http://127.0.0.1:3000` |

The browser only talks to the frontend origin (`http://127.0.0.1:5173`). API and WebSocket calls are proxied to the backend, so no API URLs are compiled into the frontend.

----------|-------------|---------|----------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000/api` | No |
| `VITE_SOCKET_URL` | Socket.io server URL | `http://localhost:3000` | No |
| `VITE_SPOTIFY_REDIRECT_URI` | Spotify OAuth callback URL (must exactly match Spotify Dashboard) | `http://localhost:5173/spotify/callback` | No |

---

## 💻 Development

### Project Structure

```
HarmonyHub/
│
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration (Redis, Spotify)
│   │   │   ├── redis.js
│   │   │   └── spotify.js
│   │   │
│   │   ├── controllers/      # Request handlers
│   │   │   ├── roomController.js
│   │   │   ├── songController.js
│   │   │   └── spotifyController.js
│   │   │
│   │   ├── routes/           # API routes
│   │   │   ├── roomRoutes.js
│   │   │   ├── songRoutes.js
│   │   │   └── spotifyRoutes.js
│   │   │
│   │   ├── services/         # Business logic
│   │   │   ├── votingService.js
│   │   │   └── spotifyService.js
│   │   │
│   │   ├── sockets/          # WebSocket handlers
│   │   │   └── votingSocket.js
│   │   │
│   │   ├── utils/            # Utilities
│   │   │   └── generateRoomCode.js
│   │   │
│   │   ├── app.js            # Express app
│   │   └── server.js         # Server entry point
│   │
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/              # API client
│   │   │   └── api.js
│   │   │
│   │   ├── components/       # React components
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── SongCard.jsx
│   │   │   ├── VoteButton.jsx
│   │   │   └── QRJoin.jsx
│   │   │
│   │   ├── hooks/            # Custom hooks
│   │   │   └── useSocket.js
│   │   │
│   │   ├── pages/            # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Room.jsx
│   │   │   └── Admin.jsx
│   │   │
│   │   ├── socket/           # Socket.io client
│   │   │   └── socket.js
│   │   │
│   │   ├── styles/           # CSS
│   │   │   └── App.css
│   │   │
│   │   ├── App.jsx           # Root component
│   │   └── main.jsx          # Entry point
│   │
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   ├── nginx.conf
│   └── Dockerfile
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

### Development Commands

#### Backend

```bash
npm start       # Start production server
npm run dev     # Start with nodemon (auto-reload)
```

#### Frontend

```bash
npm run dev     # Start dev server with HMR
npm run build   # Build for production
npm run preview # Preview production build
```

### Adding New Features

#### 1. Add a New API Endpoint

**backend/src/routes/exampleRoutes.js:**
```javascript
const express = require('express');
const router = express.Router();

router.get('/example', (req, res) => {
  res.json({ message: 'Hello!' });
});

module.exports = router;
```

**backend/src/app.js:**
```javascript
const exampleRoutes = require('./routes/exampleRoutes');
app.use('/api/example', exampleRoutes);
```

#### 2. Add a New Socket Event

**backend/src/sockets/votingSocket.js:**
```javascript
socket.on('custom_event', async (data) => {
  // Handle event
  io.to(data.roomId).emit('custom_response', result);
});
```

**frontend/src/pages/Room.jsx:**
```javascript
socket.on('custom_response', (result) => {
  console.log(result);
});
```

---

## 🏭 Production Build

### Backend

```bash
cd backend

# Build is not required (Node.js runs directly)
# But install only production dependencies:
npm ci --only=production

# Run with Node
NODE_ENV=production node src/server.js
```

### Frontend

```bash
cd frontend

# Build for production
npm run build

# Output will be in: frontend/dist/
# Serve with any static file server
```

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Create .env file in root directory
cp backend/.env.example backend/.env
# Edit backend/.env with your Spotify credentials

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Services:
- **Redis**: `localhost:6379`
- **Backend**: `localhost:3000`
- **Frontend**: `localhost:5173`

### Manual Docker Build

**Backend:**
```bash
cd backend
docker build -t harmonyhub-backend .
docker run -d -p 3000:3000 --env-file .env harmonyhub-backend
```

**Frontend:**
```bash
cd frontend
docker build -t harmonyhub-frontend .
docker run -d -p 5173:80 harmonyhub-frontend
```

---

## ☁️ Deployment (AWS Free Tier)

Deploy HarmonyHub on AWS EC2 completely **FREE** using the free tier!

### Prerequisites

- AWS Account ([Sign up](https://aws.amazon.com/free/))
- Basic terminal knowledge

### Step 1: Launch EC2 Instance

1. **Login to AWS Console** → EC2 Dashboard → Launch Instance

2. **Configure Instance:**
   - **Name:** `HarmonyHub-Server`
   - **AMI:** Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance Type:** `t2.micro` (1 vCPU, 1 GB RAM) ✓ Free tier
   - **Key Pair:** Create new or use existing (download .pem file)
   - **Network Settings:**
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 80) from anywhere (0.0.0.0/0)
     - Allow HTTPS (port 443) from anywhere
     - Allow Custom TCP (port 3000) from anywhere
     - Allow Custom TCP (port 5173) from anywhere

3. **Storage:** 8 GB gp2 (Free tier: up to 30 GB)

4. **Launch Instance**

### Step 2: Connect to EC2

```bash
# Windows (PowerShell)
ssh -i "your-key.pem" ubuntu@your-ec2-public-ip

# macOS/Linux
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Redis
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx (optional, for reverse proxy)
sudo apt install -y nginx
```

### Step 4: Clone and Setup

```bash
# Clone repository
git clone <your-repo-url>
cd HarmonyHub

# Setup Backend
cd backend
npm install
cp .env.example .env
nano .env  # Edit with your credentials
```

**Update backend/.env for production:**
```env
PORT=3000
REDIS_URL=redis://localhost:6379
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
CORS_ORIGIN=http://your-ec2-public-ip:5173
NODE_ENV=production
```

```bash
# Setup Frontend
cd ../frontend
npm install
cp .env.example .env
nano .env  # Edit with your EC2 public IP
```

**Update frontend/.env for production:**
```env
VITE_API_URL=http://your-ec2-public-ip:3000/api
VITE_SOCKET_URL=http://your-ec2-public-ip:3000
```

```bash
# Build frontend
npm run build
```

### Step 5: Run with PM2

```bash
# Start backend
cd ~/HarmonyHub/backend
pm2 start src/server.js --name harmonyhub-backend

# Serve frontend with simple HTTP server
cd ~/HarmonyHub/frontend
npm install -g serve
pm2 start "serve -s dist -l 5173" --name harmonyhub-frontend

# Save PM2 configuration
pm2 save
pm2 startup
# Run the command PM2 outputs

# Check status
pm2 status
pm2 logs
```

### Step 6: Configure Nginx (Optional - Better Performance)

```bash
sudo nano /etc/nginx/sites-available/harmonyhub
```

**Nginx configuration:**
```nginx
# Backend
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com;  # Or use IP

    root /home/ubuntu/HarmonyHub/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable configuration
sudo ln -s /etc/nginx/sites-available/harmonyhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 7: Free SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate (requires domain name)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal:
sudo certbot renew --dry-run
```

### Step 8: Monitoring & Management

```bash
# View logs
pm2 logs harmonyhub-backend
pm2 logs harmonyhub-frontend

# Restart services
pm2 restart harmonyhub-backend
pm2 restart harmonyhub-frontend

# Monitor resources
pm2 monit

# Check Redis
redis-cli ping
redis-cli info stats
```

### Cost Breakdown (Free Tier)

| Service | Free Tier Limit | Cost After |
|---------|----------------|------------|
| EC2 t2.micro | 750 hours/month (12 months) | ~$8/month |
| EBS Storage | 30 GB/month | $0.10/GB/month |
| Data Transfer | 15 GB out/month | $0.09/GB |
| Elastic IP | Free while instance running | $0.005/hour when stopped |

**First Year:** FREE ✅  
**After Free Tier:** ~$10-15/month

### Scaling Tips

**For Higher Traffic:**
- Upgrade to t2.small or t2.medium
- Use AWS RDS for Redis (ElastiCache)
- Add Application Load Balancer
- Use CloudFront CDN for frontend
- Implement Redis clustering

---

## 📡 API Documentation

### REST API Endpoints

#### Rooms

**Create Room**
```http
POST /api/rooms
Content-Type: application/json

{
  "adminName": "John Doe"
}

Response: 201 Created
{
  "roomId": "ABCD12",
  "adminName": "John Doe",
  "message": "Room created successfully"
}
```

**Get Room Details**
```http
GET /api/rooms/:roomId

Response: 200 OK
{
  "roomId": "ABCD12",
  "adminName": "John Doe",
  "createdAt": "2024-03-08T10:30:00.000Z",
  "active": "true",
  "userCount": 5
}
```

**Join Room**
```http
POST /api/rooms/:roomId/join
Content-Type: application/json

{
  "userName": "Jane Smith"
}

Response: 200 OK
{
  "message": "Joined room successfully",
  "roomId": "ABCD12",
  "userId": "Jane Smith_1234567890",
  "userName": "Jane Smith"
}
```

**Delete Room**
```http
DELETE /api/rooms/:roomId

Response: 200 OK
{
  "message": "Room deleted successfully"
}
```

#### Songs

**Get Leaderboard**
```http
GET /api/rooms/:roomId/leaderboard

Response: 200 OK
{
  "leaderboard": [
    {
      "songId": "3n3Ppam7vgaVa1iaRUc9Lp",
      "votes": 15,
      "title": "Heat Waves",
      "artist": "Glass Animals",
      "image": "https://...",
      "spotifyUrl": "https://open.spotify.com/track/...",
      "previewUrl": "https://..."
    }
  ]
}
```

**Add Song**
```http
POST /api/rooms/:roomId/songs
Content-Type: application/json

{
  "songId": "3n3Ppam7vgaVa1iaRUc9Lp",
  "title": "Heat Waves",
  "artist": "Glass Animals",
  "image": "https://...",
  "spotifyUrl": "https://...",
  "previewUrl": "https://..."
}

Response: 201 Created
{
  "message": "Song added successfully"
}
```

**Remove Song**
```http
DELETE /api/rooms/:roomId/songs/:songId

Response: 200 OK
{
  "message": "Song removed successfully"
}
```

#### Spotify

**Search Songs**
```http
GET /api/spotify/search?q=heat+waves

Response: 200 OK
{
  "songs": [
    {
      "songId": "3n3Ppam7vgaVa1iaRUc9Lp",
      "title": "Heat Waves",
      "artist": "Glass Animals",
      "image": "https://...",
      "spotifyUrl": "https://...",
      "previewUrl": "https://...",
      "duration": 238805,
      "album": "Dreamland"
    }
  ]
}
```

**Get Track Details**
```http
GET /api/spotify/track/:trackId

Response: 200 OK
{
  "track": {
    "songId": "3n3Ppam7vgaVa1iaRUc9Lp",
    "title": "Heat Waves",
    "artist": "Glass Animals",
    ...
  }
}
```

### WebSocket Events

#### Client → Server

**Join Room**
```javascript
socket.emit('join_room', roomId);
```

**Vote for Song**
```javascript
socket.emit('vote_song', {
  roomId: 'ABCD12',
  songId: '3n3Ppam7vgaVa1iaRUc9Lp'
});
```

**Add Song (Admin)**
```javascript
socket.emit('add_song', {
  roomId: 'ABCD12',
  songData: {
    songId: '...',
    title: '...',
    artist: '...',
    image: '...',
    spotifyUrl: '...',
    previewUrl: '...'
  }
});
```

**Remove Song (Admin)**
```javascript
socket.emit('remove_song', {
  roomId: 'ABCD12',
  songId: '3n3Ppam7vgaVa1iaRUc9Lp'
});
```

**Leave Room**
```javascript
socket.emit('leave_room', roomId);
```

#### Server → Client

**Leaderboard Update**
```javascript
socket.on('leaderboard_update', (leaderboard) => {
  // Array of songs with votes
  console.log(leaderboard);
});
```

**User Joined**
```javascript
socket.on('user_joined', (data) => {
  // { userId, timestamp }
});
```

**User Left**
```javascript
socket.on('user_left', (data) => {
  // { userId, timestamp }
});
```

**Error**
```javascript
socket.on('error', (error) => {
  // { message }
});
```

---

## 🔮 Future Features

The architecture is designed for easy extension. Here are planned features:

### Phase 2 (v2.0)
- 🎵 **Spotify Playback Sync** - Play songs in sync across all devices
- 💬 **Real-time Chat** - Chat with room participants
- 📝 **Queue System** - Automatic song queue management
- 🔐 **User Authentication** - Login with Spotify/Google

### Phase 3 (v3.0)
- 🤖 **AI Recommendations** - ML-powered song suggestions
- ⚖️ **Weighted Voting** - Different vote weights for users
- 📊 **Analytics Dashboard** - Room statistics and insights
- 📧 **Invitations** - Email/SMS invites
- 🎨 **Themes** - Customizable room themes

### Phase 4 (v4.0)
- 📱 **Mobile Apps** - React Native iOS/Android
- 🌍 **Multi-language** - i18n support
- 🎮 **Gamification** - Points, badges, leaderboards
- 💰 **Monetization** - Premium features

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Redis Connection Failed

**Error:** `Redis Client Error: connect ECONNREFUSED`

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If not, start Redis
# Windows
redis-server

# macOS
brew services start redis

# Linux
sudo systemctl start redis
```

#### 2. Spotify API 401 Unauthorized

**Error:** `Failed to authenticate with Spotify`

**Solution:**
- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `.env`
- Check credentials at [Spotify Dashboard](https://developer.spotify.com/dashboard)
- Ensure no extra spaces in `.env` file

#### 3. CORS Error in Browser

**Error:** `Access-Control-Allow-Origin blocked`

**Solution:**
- Update `CORS_ORIGIN` in backend `.env` to match frontend URL
- Restart backend server after changing `.env`

#### 4. Socket.io Not Connecting

**Error:** `❌ Disconnected from server`

**Solution:**
- Check backend is running on correct port
- Verify `VITE_SOCKET_URL` in frontend `.env`
- Check firewall settings (allow port 3000)

#### 5. Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

#### 6. Build Errors

**Error:** `Module not found`

**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear npm cache
npm cache clean --force
```

### Debug Mode

**Enable verbose logging:**

**Backend:**
```bash
DEBUG=* npm run dev
```

**Frontend:**
```javascript
// In socket.js, enable debug
import { io } from 'socket.io-client';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  debug: true  // Add this
});
```

---

## 📄 License

MIT License - feel free to use this project for your assignments, demos, or production apps!

---

## 🙏 Acknowledgments

- **Spotify** for the amazing Web API
- **Redis** for blazing-fast in-memory storage
- **Socket.io** for real-time magic
- **React** & **Vite** for modern frontend development
- **AWS** for generous free tier hosting

---

## 📞 Support

Having issues? Found a bug?

1. Check [Troubleshooting](#-troubleshooting) section
2. Search existing [Issues](https://github.com/yourusername/harmonyhub/issues)
3. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment (OS, Node version, etc.)

---

<div align="center">

**Built with ❤️ for music lovers**

⭐ Star this repo if you found it helpful!

[Report Bug](https://github.com/yourusername/harmonyhub/issues) • [Request Feature](https://github.com/yourusername/harmonyhub/issues)

</div>
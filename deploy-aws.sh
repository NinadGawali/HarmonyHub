#!/bin/bash
# HarmonyHub AWS Deployment Script
# Run this on your EC2 instance after SSH connection

set -e  # Exit on error

echo "🚀 HarmonyHub AWS Deployment Script"
echo "===================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo "⚠️  Please run as ubuntu user"
    exit 1
fi

# Step 1: Update system
echo -e "${YELLOW}📦 Step 1: Updating system...${NC}"
sudo apt update && sudo apt upgrade -y

# Step 2: Install Node.js 18
echo -e "${YELLOW}📦 Step 2: Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version

# Step 3: Install Redis
echo -e "${YELLOW}📦 Step 3: Installing Redis...${NC}"
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis
redis-cli ping

# Step 4: Install PM2
echo -e "${YELLOW}📦 Step 4: Installing PM2...${NC}"
sudo npm install -g pm2

# Step 5: Install Nginx (optional)
echo -e "${YELLOW}📦 Step 5: Installing Nginx...${NC}"
sudo apt install -y nginx

# Step 6: Clone repository
echo -e "${YELLOW}📥 Step 6: Enter your repository details${NC}"
read -p "Enter your GitHub repository URL: " REPO_URL
git clone $REPO_URL HarmonyHub
cd HarmonyHub

# Step 7: Setup Backend
echo -e "${YELLOW}⚙️  Step 7: Setting up Backend...${NC}"
cd backend
npm install

# Create .env file
echo -e "${YELLOW}🔑 Creating backend .env file...${NC}"
read -p "Enter your EC2 Public IP: " EC2_IP
read -p "Enter Spotify Client ID: " SPOTIFY_CLIENT_ID
read -p "Enter Spotify Client Secret: " SPOTIFY_CLIENT_SECRET

cat > .env << EOF
PORT=3000
REDIS_URL=redis://localhost:6379
SPOTIFY_CLIENT_ID=$SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET=$SPOTIFY_CLIENT_SECRET
CORS_ORIGIN=http://$EC2_IP:5173,http://$EC2_IP
NODE_ENV=production
EOF

echo -e "${GREEN}✓ Backend .env created${NC}"

# Step 8: Setup Frontend
echo -e "${YELLOW}⚙️  Step 8: Setting up Frontend...${NC}"
cd ../frontend
npm install

# Create frontend .env
cat > .env << EOF
VITE_API_URL=http://$EC2_IP:3000/api
VITE_SOCKET_URL=http://$EC2_IP:3000
EOF

echo -e "${GREEN}✓ Frontend .env created${NC}"

# Build frontend
echo -e "${YELLOW}🏗️  Building frontend...${NC}"
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# Step 9: Start with PM2
echo -e "${YELLOW}🚀 Step 9: Starting services with PM2...${NC}"
cd ~/HarmonyHub/backend
pm2 start src/server.js --name harmonyhub-backend

# Install serve for frontend
sudo npm install -g serve
cd ~/HarmonyHub/frontend
pm2 start "serve -s dist -l 5173" --name harmonyhub-frontend

# Save PM2 config
pm2 save

# Setup PM2 startup
echo -e "${YELLOW}⚙️  Setting up PM2 startup...${NC}"
pm2 startup | tail -n 1 | sudo bash

# Step 10: Show status
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "📊 Service Status:"
pm2 status

echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://$EC2_IP:5173"
echo "   Backend:  http://$EC2_IP:3000"
echo ""
echo "📝 Useful commands:"
echo "   pm2 logs             - View all logs"
echo "   pm2 restart all      - Restart services"
echo "   pm2 stop all         - Stop services"
echo "   pm2 monit            - Monitor resources"
echo ""
echo "🔒 Next steps:"
echo "   1. Configure security groups in AWS Console"
echo "   2. Setup custom domain (optional)"
echo "   3. Add SSL certificate with Let's Encrypt"
echo ""

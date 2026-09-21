# AWS Deployment Checklist

## ✅ Pre-Deployment

### 1. AWS Account Setup
- [ ] Create AWS account: https://aws.amazon.com/free/
- [ ] Verify email and phone
- [ ] Add payment method (won't be charged if staying in free tier)

### 2. Spotify API Setup
- [ ] Go to https://developer.spotify.com/dashboard
- [ ] Create new app
- [ ] Copy Client ID
- [ ] Copy Client Secret
- [ ] Add redirect URI (http://your-ec2-ip:3000/callback)

### 3. Code Preparation
- [ ] Test app locally (both backend and frontend working)
- [ ] Commit all changes to GitHub
- [ ] Note your GitHub repository URL

---

## 🖥️ AWS EC2 Setup

### Step 1: Launch Instance (5 minutes)

1. **Login to AWS Console**
   - Go to: https://console.aws.amazon.com/
   - Search for "EC2" in top search bar
   - Click "Launch Instance"

2. **Configure Instance**
   - **Name:** `HarmonyHub-Server`
   - **AMI:** Ubuntu Server 22.04 LTS (Free tier eligible) ✓
   - **Instance Type:** `t2.micro` (Free tier eligible) ✓
   - **Key Pair:** 
     - Click "Create new key pair"
     - Name: `harmonyhub-key`
     - Type: RSA
     - Format: .pem (for Windows use PuTTY: .ppk)
     - **DOWNLOAD and SAVE the .pem file!** (you can't download it again)

3. **Network Settings**
   - Click "Edit"
   - Create Security Group:
     - Name: `harmonyhub-sg`
     - **Add Rules:**
       - SSH (22) - Source: My IP
       - HTTP (80) - Source: Anywhere (0.0.0.0/0)
       - HTTPS (443) - Source: Anywhere
       - Custom TCP (3000) - Source: Anywhere (Backend)
       - Custom TCP (5173) - Source: Anywhere (Frontend)

4. **Storage**
   - Keep default: 8 GB gp2 (Free tier: up to 30 GB)

5. **Launch!**
   - Click "Launch Instance"
   - Wait 1-2 minutes
   - Click "View Instances"
   - **Copy your Public IPv4 address** (something like 18.xxx.xxx.xxx)

---

## 🔌 Connect to EC2 (2 minutes)

### Windows (PowerShell)
```powershell
# Navigate to where you saved the .pem file
cd Downloads

# Connect (replace YOUR-EC2-IP with actual IP)
ssh -i harmonyhub-key.pem ubuntu@YOUR-EC2-IP
```

### macOS/Linux (Terminal)
```bash
# Navigate to where you saved the .pem file
cd ~/Downloads

# Fix permissions
chmod 400 harmonyhub-key.pem

# Connect
ssh -i harmonyhub-key.pem ubuntu@YOUR-EC2-IP
```

**First time:** Type `yes` when asked about host authenticity

---

## 🚀 Deployment (10 minutes)

### Option A: Automated Script (Recommended)

1. **Download and run the deployment script:**
```bash
# Download script
wget https://raw.githubusercontent.com/YOUR-USERNAME/HarmonyHub/main/deploy-aws.sh

# Make executable
chmod +x deploy-aws.sh

# Run script
./deploy-aws.sh
```

2. **Follow the prompts:**
   - Enter GitHub repository URL
   - Enter EC2 Public IP
   - Enter Spotify Client ID
   - Enter Spotify Client Secret

3. **Done!** Script will handle everything automatically.

---

### Option B: Manual Steps

<details>
<summary>Click to expand manual deployment steps</summary>

#### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### 2. Install Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v18.x.x
```

#### 3. Install Redis
```bash
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis
redis-cli ping  # Should return PONG
```

#### 4. Install PM2
```bash
sudo npm install -g pm2
```

#### 5. Clone Repository
```bash
git clone YOUR-GITHUB-REPO-URL
cd HarmonyHub
```

#### 6. Setup Backend
```bash
cd backend
npm install

# Create .env file
nano .env
```

**Paste this (replace with your values):**
```env
PORT=3000
REDIS_URL=redis://localhost:6379
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
CORS_ORIGIN=http://YOUR-EC2-IP:5173
NODE_ENV=production
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

#### 7. Setup Frontend
```bash
cd ../frontend
npm install

# Create .env file
nano .env
```

**Paste this (replace with your EC2 IP):**
```env
VITE_API_URL=http://YOUR-EC2-IP:3000/api
VITE_SOCKET_URL=http://YOUR-EC2-IP:3000
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

**Build frontend:**
```bash
npm run build
```

#### 8. Start with PM2
```bash
# Start backend
cd ~/HarmonyHub/backend
pm2 start src/server.js --name harmonyhub-backend

# Install serve for frontend
sudo npm install -g serve
cd ~/HarmonyHub/frontend
pm2 start "serve -s dist -l 5173" --name harmonyhub-frontend

# Save PM2 config
pm2 save

# Setup auto-start on reboot
pm2 startup
# Copy and run the command it outputs
```

</details>

---

## ✅ Verify Deployment

### 1. Check Services
```bash
pm2 status
```

Should show:
```
┌────┬────────────────────────┬──────────┬──────┬───────────┐
│ id │ name                   │ status   │ cpu  │ memory    │
├────┼────────────────────────┼──────────┼──────┼───────────┤
│ 0  │ harmonyhub-backend     │ online   │ 0%   │ 50.0mb    │
│ 1  │ harmonyhub-frontend    │ online   │ 0%   │ 30.0mb    │
└────┴────────────────────────┴──────────┴──────┴───────────┘
```

### 2. Check Logs
```bash
pm2 logs --lines 20
```

Should see "Server running on port 3000" and "Serving!"

### 3. Test in Browser

**Frontend:** http://YOUR-EC2-IP:5173
- Should load HarmonyHub home page
- Should be able to create room

**Backend:** http://YOUR-EC2-IP:3000/api/health
- Should show: `{"status":"ok"}`

### 4. Test Full Flow
1. ✅ Create admin room
2. ✅ Search for songs (Spotify API working)
3. ✅ Add songs to room
4. ✅ Open room in another tab (as user)
5. ✅ Vote on songs (real-time working)
6. ✅ Close voting (music player appears)

---

## 🔧 Troubleshooting

### Backend not starting
```bash
# Check logs
pm2 logs harmonyhub-backend

# Check if port is in use
sudo lsof -i :3000

# Restart
pm2 restart harmonyhub-backend
```

### Frontend not loading
```bash
# Check logs
pm2 logs harmonyhub-frontend

# Rebuild
cd ~/HarmonyHub/frontend
npm run build
pm2 restart harmonyhub-frontend
```

### Redis connection error
```bash
# Check Redis status
sudo systemctl status redis

# Restart Redis
sudo systemctl restart redis

# Test connection
redis-cli ping
```

### Can't access from browser
1. Check Security Group rules in AWS Console
2. Make sure ports 3000 and 5173 are open
3. Use HTTP not HTTPS (http://YOUR-IP:5173)
4. Check EC2 public IP hasn't changed

---

## 📊 Monitoring (Daily)

### Check Service Health
```bash
pm2 status
pm2 monit  # Real-time monitoring
```

### View Logs
```bash
pm2 logs
pm2 logs harmonyhub-backend --lines 50
pm2 logs harmonyhub-frontend --lines 50
```

### Check Redis
```bash
redis-cli info stats
redis-cli DBSIZE  # Number of keys
redis-cli KEYS "*"  # List all keys (don't use in production with many keys)
```

### Check Disk Space
```bash
df -h
```

### Check Memory
```bash
free -h
```

---

## 🔐 Security Best Practices

### 1. Update Backend Security Group
After testing, restrict backend port:
- AWS Console → EC2 → Security Groups
- Edit inbound rules
- Port 3000: Change source from "Anywhere" to "My IP" or frontend IP

### 2. Regular Updates
```bash
# Weekly
sudo apt update && sudo apt upgrade -y
npm update -g pm2
```

### 3. Setup SSL (Optional - Requires Domain)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d yourdomain.com
```

---

## 💰 Cost Monitoring

### Free Tier Limits (12 months)
- ✅ EC2 t2.micro: 750 hours/month (31 days × 24 hours = 744 hours)
- ✅ 30 GB Storage
- ✅ 15 GB Data Transfer Out

### After Free Tier (~$10-15/month)
- EC2 t2.micro: ~$8/month
- 8 GB Storage: ~$0.80/month
- Data Transfer: Variable

### Check Your Bill
- AWS Console → Billing Dashboard
- Set up billing alerts (recommended)

---

## 🎯 Next Steps

### Production Improvements
- [ ] Add custom domain name
- [ ] Setup SSL certificate (HTTPS)
- [ ] Configure Nginx reverse proxy
- [ ] Setup automated backups
- [ ] Add monitoring (CloudWatch)
- [ ] Setup CI/CD (GitHub Actions)

### Scaling
- [ ] Upgrade to larger instance (t2.small)
- [ ] Use AWS ElastiCache for Redis
- [ ] Setup Load Balancer
- [ ] Use CloudFront CDN
- [ ] Implement caching strategy

---

## 📞 Support

### Useful Commands Reference
```bash
# PM2
pm2 list                    # List all processes
pm2 logs                    # View logs
pm2 restart all             # Restart all
pm2 stop all                # Stop all
pm2 delete all              # Remove all
pm2 monit                   # Monitor CPU/Memory

# Redis
redis-cli ping              # Test connection
redis-cli info              # Redis info
redis-cli FLUSHALL          # Clear all data (CAREFUL!)

# System
sudo systemctl status redis # Check Redis
sudo systemctl restart redis # Restart Redis
htop                        # System monitor
```

### Getting Help
- Check [README.md](README.md) for full documentation
- Check pm2 logs: `pm2 logs`
- Check AWS Console for instance status
- Restart services: `pm2 restart all`

---

**🎉 Congratulations! HarmonyHub is now live on AWS!**

Share your app: `http://YOUR-EC2-IP:5173`

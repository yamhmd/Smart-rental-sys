# 🚀 Railway Deployment Guide

Your Smart Rental App is now configured to run on **Railway** with full support for both local development and production deployment.

---

## ✅ What's Ready

- ✅ Database connection supports Railway environment variables
- ✅ Frontend API calls work with both local and Railway URLs
- ✅ Server detects environment and logs appropriately
- ✅ CORS already enabled for cross-origin requests
- ✅ PORT is configurable via environment variable

---

## 🏠 Local Development (Current Setup)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database (First Time Only)
```bash
npm run setup-db
```

This creates the database and tables using your local `.env` credentials.

### 3. Seed Demo Users (Optional)
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

- Open: http://localhost:3000/auth.html
- API: http://localhost:3000/api
- Files auto-reload on changes

---

## 🚀 Deploy to Railway

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub" or "Deploy Dockerfile"
4. Connect your repository

### Step 2: Add MySQL Database
1. In Railway dashboard, click "New"
2. Select "MySQL"
3. Railway automatically sets `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`

### Step 3: Set Environment Variables
In your Railway project settings, add:

```
NODE_ENV=production
JWT_SECRET=your-secret-key-here
PORT=3000
```

**The database variables are automatically set by the MySQL plugin.**

### Step 4: Deploy Your App
1. Connect your GitHub repository to Railway
2. Railway automatically builds and deploys on push
3. Your app will be available at: `https://your-project-name.up.railway.app`

### Step 5: Setup Database on Railway
After first deployment, run the setup script:

```bash
# Via Railway CLI
railway run npm run setup-db

# Or manually in Railway terminal
```

### Step 6: Seed Demo Users (Optional)
```bash
railway run npm run seed
```

---

## 🔄 Environment Variables

### Local Development (.env)
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=railway
JWT_SECRET=your-jwt-secret
```

### Railway (Set in Dashboard)
Railway automatically provides:
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

Your app code supports both naming conventions:
```javascript
const dbHost = process.env.MYSQLHOST || process.env.DB_HOST;
const dbUser = process.env.MYSQLUSER || process.env.DB_USER;
// etc...
```

---

## 🧪 Testing

### Local Testing
```bash
# Run setup
npm run setup-db

# Start server
npm run dev

# Test in browser
open http://localhost:3000/auth.html

# Check database
npm run check-db
```

### Railway Testing
1. Visit your Railway domain: `https://your-project.up.railway.app`
2. Register a test account
3. Log in and verify functionality
4. Check Railway logs for errors

---

## 🐛 Troubleshooting

### Issue: Database Connection Fails on Railway
**Solution:**
1. Check MySQL database is added to Railway project
2. Verify `MYSQLDATABASE` environment variable is set
3. Run: `railway run npm run setup-db`

### Issue: Frontend Can't Reach Backend API
**Solution:**
1. Verify `NODE_ENV=production` is set
2. Check that backend URL is accessible: `https://your-project.up.railway.app/api`
3. Verify CORS is not blocking (already configured)

### Issue: Port Binding Error
**Solution:**
1. Set `PORT=3000` in Railway environment variables
2. Check no other service is using that port

### Issue: JWT Token Not Working
**Solution:**
1. Set same `JWT_SECRET` value on Railway dashboard
2. Regenerate and re-login with new token

---

## 📊 Monitoring

### View Railway Logs
```bash
railway logs
```

### Database Connection Status
The console logs show:
- ✅ Local: `MySQL pool connected to railway (local)`
- ✅ Railway: `MySQL pool connected to railway (Railway)`

### Health Check Endpoint
```bash
curl https://your-project.up.railway.app/api/health
# Returns: {"ok": true, "time": "2024-05-18T..."}
```

---

## 🔒 Security Checklist

- ✅ `.env` file is in `.gitignore` (don't commit secrets)
- ✅ JWT_SECRET is unique and strong
- ✅ Database credentials stored in Railway environment (never in code)
- ✅ CORS enabled for frontend domain
- ✅ Password hashing with bcrypt

---

## 📝 Key Files Updated

1. **server.js** - Environment-aware logging
2. **db/connection.js** - Railway variable support with fallbacks
3. **public/assets/js/app.js** - Intelligent API_BASE URL detection

---

## 💡 Tips

- Use `npm run dev` during local development (auto-reload)
- Test locally before pushing to Railway
- Check Railway logs for any connection issues
- Railway redeploys automatically on Git push
- Use `railway shell` to run commands in production environment

---

## 🎯 Next Steps

1. **Test locally:** `npm run dev`
2. **Push to GitHub:** `git push`
3. **Railway deploys automatically**
4. **Visit your Railway domain**
5. **Test registration and login**

Happy deploying! 🎉

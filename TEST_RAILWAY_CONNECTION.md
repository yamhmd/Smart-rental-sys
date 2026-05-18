# 🧪 Test Railway Database Connection - Step by Step

Follow these steps to verify your app connects to Railway MySQL database.

---

## 🔍 Step 1: Verify Environment Variables on Railway

### Option A: Using Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app)
2. Login to your account
3. Click your project
4. Click the **MySQL** plugin
5. Go to the **Variables** tab
6. You should see:
   - `MYSQLHOST` (e.g., `crossover.proxy.rlwy.net`)
   - `MYSQLPORT` (e.g., `57809`)
   - `MYSQLUSER` (e.g., `root`)
   - `MYSQLPASSWORD` (long string)
   - `MYSQLDATABASE` (e.g., `railway`)

✅ **If you see all 5 variables, move to Step 2**
❌ **If any are missing, add MySQL database first**

---

## ✅ Step 2: Test Connection with Local App Using Railway Credentials

### A. Update .env with Railway Values

1. Open `.env` file in your project:
   ```
   .env
   ```

2. Make sure it matches your Railway variables:
   ```env
   DB_HOST=crossover.proxy.rlwy.net
   DB_PORT=57809
   DB_USER=root
   DB_PASSWORD=aklTQdMLOGwMMjLKLZJKoHIHnMSSHdqF
   DB_NAME=railway
   JWT_SECRET=46b9ef20-d1a8-40c5-925b-c688fec6859d
   ```

### B. Test Database Connection Locally

Open terminal and run:

```bash
# Test 1: Setup database tables
npm run setup-db
```

✅ **Expected Output:**
```
✅ Database 'railway' ready
Step 2: Creating tables...
✅ Tables created/verified
✅ Migration complete
```

❌ **If you get connection error:**
- Verify `.env` credentials match Railway exactly
- Check Railway MySQL is not suspended
- Ensure your IP is not blocked

### C. Seed Demo Users

```bash
npm run seed
```

✅ **Expected Output:**
```
✅ admin@rental.com already exists, skipping
✅ manager@rental.com already exists, skipping
...
```

---

## 🚀 Step 3: Start Your App and Check Logs

### A. Start the Server

```bash
npm start
```

### B. Check for These Log Messages

Look for lines like:

✅ **Success:**
```
✅ MySQL pool connected to railway (local)
🏢  Smart Rental running
    Environment: development
    Port: 3000
    Web:  http://localhost:3000
    API:  http://localhost:3000/api
```

❌ **Error (means connection failed):**
```
❌ MySQL connection failed after 5 attempts
⚠️  Connection attempt 1 failed: PROTOCOL_CONNECTION_LOST
```

---

## 🧪 Step 4: Test API Endpoints

Open a **new terminal** (keep server running) and test:

### A. Test Health Check Endpoint

```bash
curl http://localhost:3000/api/health
```

✅ **Expected:**
```json
{"ok":true,"time":"2024-05-18T..."}
```

### B. Register a Test User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@railway.com",
    "password": "TestPass123",
    "full_name": "Railway Test",
    "role": "tenant"
  }'
```

✅ **Expected:**
```json
{"message":"Registration successful","user":{"user_id":123,"email":"test@railway.com",...}}
```

❌ **If error, check:**
- Is server running?
- Is database connected?

### C. Verify Data was Saved

```bash
npm run check-db
```

✅ **Expected:**
```
Total users: 6
[test@railway.com] → tenant
```

---

## 🔗 Step 5: Test in Browser (Full Test)

### A. Open App in Browser

1. Go to: http://localhost:3000/auth.html
2. Click **"Register"** button
3. Fill form:
   - Email: `browsertest@railway.com`
   - Password: `BrowserTest123`
   - Full Name: `Browser Test User`
   - Role: `Tenant` (select from dropdown)
4. Click **Register**

✅ **Success means:**
- ✅ Frontend connected to API
- ✅ API connected to database
- ✅ Data saved to Railway database

### B. Verify Login Works

1. Click **"Login"** button
2. Use email: `browsertest@railway.com`
3. Use password: `BrowserTest123`
4. Click **Login**

✅ **If login works**, database is definitely connected!

---

## 📊 Complete Test Checklist

Check off each test as you complete it:

- [ ] **Environment Variables**: Railway dashboard shows all 5 MySQL variables
- [ ] **Local .env**: Credentials match Railway exactly
- [ ] **Setup DB**: `npm run setup-db` completes with ✅ messages
- [ ] **Seed Users**: `npm run seed` runs successfully
- [ ] **Server Startup**: `npm start` shows ✅ connection message
- [ ] **Health Check**: `curl /api/health` returns JSON
- [ ] **Register User**: `curl /api/auth/register` creates user
- [ ] **Check DB**: `npm run check-db` shows new users
- [ ] **Browser Register**: New user appears after registration
- [ ] **Browser Login**: Can login with new user

✅ **If all 10 pass, your Railway database is fully connected!**

---

## ❌ Troubleshooting

### Problem: "Connection refused" or "ECONNREFUSED"

**Cause**: Can't reach Railway database from your local machine

**Solution**:
1. Check Railway MySQL is running (not suspended)
2. Verify `DB_HOST` in `.env` is correct
3. Check firewall isn't blocking port 57809
4. Try: `telnet crossover.proxy.rlwy.net 57809`

### Problem: "Access denied for user 'root'"

**Cause**: Wrong password in `.env`

**Solution**:
1. Copy password from Railway dashboard exactly
2. Check for extra spaces or special characters
3. If changed on Railway, update `.env`

### Problem: "Unknown database 'railway'"

**Cause**: Database name doesn't match

**Solution**:
1. Verify `DB_NAME` matches Railway `MYSQLDATABASE`
2. Run: `npm run setup-db` to create database

### Problem: "ER_NOT_SUPPORTED_AUTH_TYPE"

**Cause**: MySQL version or connection issue

**Solution**:
```bash
# Reconnect to refresh connection
npm install mysql2@latest
npm start
```

---

## 📝 What Each Command Does

| Command | What It Tests |
|---------|---------------|
| `npm run setup-db` | Creates database & tables |
| `npm run seed` | Adds demo users |
| `npm run check-db` | Lists all users in database |
| `npm start` | Starts app, connects to DB |
| `curl /api/health` | Tests API is responding |
| `curl /api/auth/register` | Tests user creation |

---

## 🎯 Expected Results Timeline

1. **After `setup-db`**: Database created, tables ready
2. **After `npm start`**: Console shows ✅ MySQL connected
3. **After test registration**: New user in Railway database
4. **After browser login**: Auth token issued, user logged in
5. **On Railway.app**: See data in MySQL database

---

## ✨ Quick Test (3 minutes)

If you just want quick confirmation:

```bash
# Terminal 1
npm start
# Watch for: "✅ MySQL pool connected to railway"

# Terminal 2 (while server is running)
curl http://localhost:3000/api/health
# If you get: {"ok":true,"time":"..."}
# Your database is connected!
```

---

## 🚀 Next: Test on Railway Production

Once local testing passes:

```bash
# Deploy to Railway
git push

# Wait for Railway to auto-deploy (check dashboard)

# Run setup on Railway
railway run npm run setup-db

# Check production app
# https://your-project.up.railway.app/auth.html
```

---

Need help? Check the detailed RAILWAY_DEPLOYMENT.md for more info!

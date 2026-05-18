require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const statsRoutes = require('./routes/stats');
const tenantRoutes = require('./routes/tenant');
const userAdminRoutes = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',      authRoutes);
app.use('/api',           propertyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/users', userAdminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  console.error('Unhandled:', err);
  res.status(500).json({ error: 'Server error' });
});

app.listen(PORT, () => {
  const env = process.env.NODE_ENV || 'development';
  const host = env === 'production' ? 'Railway-deployed' : 'localhost:' + PORT;
  console.log('');
  console.log('🏢  Smart Rental running');
  console.log(`    Environment: ${env}`);
  console.log(`    Port: ${PORT}`);
  if (env === 'development') {
    console.log('    Web:  http://localhost:' + PORT);
    console.log('    API:  http://localhost:' + PORT + '/api');
  } else {
    console.log('    Running on Railway - visit your Railway domain');
  }
  console.log('');
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const suppliersRoutes = require('./routes/suppliers');
const materialsRoutes = require('./routes/materials');
const lotsRoutes = require('./routes/lots');
const qcRoutes = require('./routes/qc');
const ppicRoutes = require('./routes/ppic');
const warehouseRoutes = require('./routes/warehouse');
const dispatchRoutes = require('./routes/dispatch');
const auditRoutes = require('./routes/audit');
const dashboardRoutes = require('./routes/dashboard');
const searchRoutes = require('./routes/search');
const seedRoutes = require('./routes/seed');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/lots', lotsRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/ppic', ppicRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/seed', seedRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'AromOS API', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AromOS API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;

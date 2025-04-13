// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-auth-token'],
  exposedHeaders: ['Content-Disposition']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware to handle array and comma-separated values
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    // Handle selected_students
    if (req.body.selected_students) {
      if (typeof req.body.selected_students === 'string') {
        req.body.selected_students = req.body.selected_students
          .split(',')
          .map(id => id.trim())
          .filter(id => id);
      }
    }

    // Handle selected_topics
    if (req.body.selected_topics) {
      if (typeof req.body.selected_topics === 'string') {
        req.body.selected_topics = req.body.selected_topics
          .split(',')
          .map(id => id.trim())
          .filter(id => id);
      }
    }
  }
  next();
});

// Configure Helmet but disable certain features for iframe embedding
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:8080"],
    }
  },
  frameguard: { action: 'sameorigin' }
}));

// Serve uploaded files with proper headers
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Content-Security-Policy', "frame-ancestors 'self' http://localhost:8080");
  res.header('X-Frame-Options', 'SAMEORIGIN');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/class', require('./routes/class'));
app.use('/api/assignment', require('./routes/assignment'));
app.use('/api/topic', require('./routes/topic'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
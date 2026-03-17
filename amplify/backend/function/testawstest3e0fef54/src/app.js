const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage (replace with DynamoDB for production)
let items = [];

// ============================================
// REST API Routes
// ============================================

// GET /items — Получить все элементы
app.get('/items', (req, res) => {
  res.json({
    success: true,
    data: items,
    count: items.length,
  });
});

// GET /items/:id — Получить один элемент по ID
app.get('/items/:id', (req, res) => {
  const item = items.find((i) => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }
  res.json({
    success: true,
    data: item,
  });
});

// POST /items — Создать новый элемент
app.post('/items', (req, res) => {
  const { name, description, category } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Name is required',
    });
  }

  const newItem = {
    id: uuidv4(),
    name,
    description: description || '',
    category: category || 'general',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  items.push(newItem);

  res.status(201).json({
    success: true,
    data: newItem,
    message: 'Item created successfully',
  });
});

// PUT /items/:id — Обновить элемент
app.put('/items/:id', (req, res) => {
  const index = items.findIndex((i) => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  const { name, description, category } = req.body;
  items[index] = {
    ...items[index],
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(category && { category }),
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: items[index],
    message: 'Item updated successfully',
  });
});

// DELETE /items/:id — Удалить элемент
app.delete('/items/:id', (req, res) => {
  const index = items.findIndex((i) => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({
      success: false,
      error: 'Item not found',
    });
  }

  const deleted = items.splice(index, 1)[0];

  res.json({
    success: true,
    data: deleted,
    message: 'Item deleted successfully',
  });
});

// Health check endpoint
app.get('/items/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

module.exports = app;

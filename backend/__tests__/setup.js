// Test setup - runs before each test
process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key-123';

// Clear require cache to ensure fresh module loads
beforeEach(() => {
  jest.resetModules();
});

// Global test utilities
global.createTestApp = () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  return app;
};

// Mock console to keep test output clean
global.console.log = jest.fn();
global.console.error = jest.fn();
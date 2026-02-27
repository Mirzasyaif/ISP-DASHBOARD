const request = require('supertest');
const { mockMikrotik } = require('./mocks/mikrotik');

// Mock Mikrotik module
jest.mock('../../utils/mikrotik-client', () => mockMikrotik);

describe('API Endpoints', () => {
  let app;
  
  beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = 'test-api-key-123';
    
    // Create app instance
    app = require('../../index');
  });
  
  afterAll(() => {
    // Cleanup
    jest.resetModules();
  });
  
  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('uptime');
    });
    
    test('GET /health without API key should fail', async () => {
      const response = await request(app)
        .get('/health');
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'API key required');
    });
  });
  
  describe('Client Management', () => {
    test('GET /api/clients should return clients', async () => {
      const response = await request(app)
        .get('/api/clients')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
    
    test('POST /api/clients should create new client', async () => {
      const newClient = {
        name: 'Test User',
        ip_address: '10.11.1.100',
        monthly_fee: 110000
      };
      
      const response = await request(app)
        .post('/api/clients')
        .set('x-api-key', 'test-api-key-123')
        .send(newClient);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test User');
    });
    
    test('POST /api/clients with invalid data should fail', async () => {
      const invalidClient = {
        name: '', // Empty name
        monthly_fee: 'invalid'
      };
      
      const response = await request(app)
        .post('/api/clients')
        .set('x-api-key', 'test-api-key-123')
        .send(invalidClient);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Payment Endpoints', () => {
    test('GET /api/payments should return payments', async () => {
      const response = await request(app)
        .get('/api/payments')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
    
    test('POST /api/payments should record payment', async () => {
      const payment = {
        user_id: 1,
        amount: 110000,
        note: 'Test payment'
      };
      
      const response = await request(app)
        .post('/api/payments')
        .set('x-api-key', 'test-api-key-123')
        .send(payment);
      
      expect([200, 201]).toContain(response.status);
      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(110000);
    });
  });
  
  describe('Mikrotik Integration', () => {
    test('GET /api/mikrotik/test should test connection', async () => {
      const response = await request(app)
        .get('/api/mikrotik/test')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('connected', true);
    });
    
    test('GET /api/mikrotik/pppoe/active should return active users', async () => {
      const response = await request(app)
        .get('/api/mikrotik/pppoe/active')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3); // From mock
    });
    
    test('POST /api/mikrotik/pppoe/disconnect should disconnect user', async () => {
      const response = await request(app)
        .post('/api/mikrotik/pppoe/disconnect')
        .set('x-api-key', 'test-api-key-123')
        .send({ username: 'USER1' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
    });
  });
  
  describe('Error Handling', () => {
    test('Invalid endpoint should return 404', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .set('x-api-key', 'test-api-key-123');
      
      expect(response.status).toBe(404);
    });
    
    test('Invalid API key should return 403', async () => {
      const response = await request(app)
        .get('/api/clients')
        .set('x-api-key', 'wrong-key');
      
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Invalid API key');
    });
  });
});
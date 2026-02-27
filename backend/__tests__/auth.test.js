const { authenticateAPI, authenticateAdmin } = require('../../middleware/auth');
const { getConfig } = require('../../config/config');

describe('Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;
  
  beforeEach(() => {
    mockReq = {
      headers: {},
      query: {},
      path: '/test'
    };
    
    mockRes = {
      status: jest.fn(() => mockRes),
      json: jest.fn()
    };
    
    mockNext = jest.fn();
    
    // Mock config
    jest.mock('../../config/config', () => ({
      getConfig: jest.fn(() => ({
        api_key: 'test-api-key-123',
        admin_key: 'admin-key-456'
      }))
    }));
  });
  
  describe('authenticateAPI', () => {
    test('should reject request without API key', () => {
      authenticateAPI(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'API key required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should reject request with invalid API key', () => {
      mockReq.headers['x-api-key'] = 'wrong-key';
      authenticateAPI(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should accept request with valid API key in headers', () => {
      mockReq.headers['x-api-key'] = 'test-api-key-123';
      authenticateAPI(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
    
    test('should accept request with valid API key in query params', () => {
      mockReq.query.api_key = 'test-api-key-123';
      authenticateAPI(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
  
  describe('authenticateAdmin', () => {
    test('should reject non-admin API key', () => {
      mockReq.headers['x-api-key'] = 'test-api-key-123'; // regular key
      authenticateAdmin(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
    
    test('should accept admin API key', () => {
      mockReq.headers['x-api-key'] = 'admin-key-456';
      authenticateAdmin(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
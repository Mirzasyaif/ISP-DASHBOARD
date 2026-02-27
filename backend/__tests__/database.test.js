const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');
jest.mock('path');

describe('Database Functions', () => {
  const mockData = {
    users: [
      { id: 1, name: 'User1', ip: '10.11.1.10', monthly_fee: 110000 },
      { id: 2, name: 'User2', ip: '10.11.1.11', monthly_fee: 120000 }
    ],
    payments: [
      { id: 1, user_id: 1, amount: 110000, date: '2026-02-01' },
      { id: 2, user_id: 2, amount: 120000, date: '2026-02-01' }
    ],
    config: { setup_completed: true }
  };
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock path.join
    path.join.mockReturnValue('/mock/db.json');
    
    // Mock fs.existsSync
    fs.existsSync.mockImplementation((filePath) => {
      if (filePath === '/mock/db.json') return true;
      return false;
    });
    
    // Mock fs.readFileSync
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
    
    // Mock fs.writeFileSync
    fs.writeFileSync.mockImplementation(() => {});
    
    // Mock fs.renameSync
    fs.renameSync.mockImplementation(() => {});
  });
  
  test('readDB should parse JSON correctly', () => {
    const { readDB } = require('../../models/simple-db');
    
    const result = readDB();
    
    expect(fs.readFileSync).toHaveBeenCalledWith('/mock/db.json', 'utf8');
    expect(result.users).toHaveLength(2);
    expect(result.users[0].name).toBe('User1');
    expect(result.users[1].monthly_fee).toBe(120000);
  });
  
  test('readDB should return default data on error', () => {
    fs.readFileSync.mockImplementation(() => {
      throw new Error('File read error');
    });
    
    const { readDB } = require('../../models/simple-db');
    
    const result = readDB();
    
    expect(result.users).toEqual([]);
    expect(result.payments).toEqual([]);
    expect(result.config).toEqual({});
  });
  
  test('writeDB should use atomic write pattern', () => {
    const { writeDB } = require('../../models/simple-db');
    
    writeDB(mockData);
    
    // Should write to temp file first
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/mock/db.json.tmp',
      JSON.stringify(mockData, null, 2),
      'utf8'
    );
    
    // Then rename temp to actual
    expect(fs.renameSync).toHaveBeenCalledWith(
      '/mock/db.json.tmp',
      '/mock/db.json'
    );
  });
  
  test('writeDB should handle rename failure gracefully', () => {
    fs.renameSync.mockImplementation(() => {
      throw new Error('Rename failed');
    });
    
    const { writeDB } = require('../../models/simple-db');
    
    // Should not throw, just log error
    expect(() => writeDB(mockData)).not.toThrow();
  });
  
  describe('Client CRUD operations', () => {
    test('getClients should return all users', () => {
      const { getClients } = require('../../models/simple-db');
      
      const clients = getClients();
      
      expect(clients).toHaveLength(2);
      expect(clients[0].name).toBe('User1');
      expect(clients[1].ip).toBe('10.11.1.11');
    });
    
    test('getClientById should find user by id', () => {
      const { getClientById } = require('../../models/simple-db');
      
      const client = getClientById(1);
      
      expect(client).toBeDefined();
      expect(client.name).toBe('User1');
    });
    
    test('getClientById should return null for non-existent id', () => {
      const { getClientById } = require('../../models/simple-db');
      
      const client = getClientById(999);
      
      expect(client).toBeNull();
    });
  });
  
  describe('Payment operations', () => {
    test('getPayments should return all payments', () => {
      const { getPayments } = require('../../models/simple-db');
      
      const payments = getPayments();
      
      expect(payments).toHaveLength(2);
      expect(payments[0].amount).toBe(110000);
      expect(payments[1].user_id).toBe(2);
    });
    
    test('getPaymentsByUserId should filter correctly', () => {
      const { getPaymentsByUserId } = require('../../models/simple-db');
      
      const payments = getPaymentsByUserId(1);
      
      expect(payments).toHaveLength(1);
      expect(payments[0].amount).toBe(110000);
    });
    
    test('getUserMonthlyFee should return correct fee', () => {
      const { getUserMonthlyFee } = require('../../models/simple-db');
      
      const fee = getUserMonthlyFee(1);
      
      expect(fee).toBe(110000);
    });
    
    test('getUserMonthlyFee should return default for non-existent user', () => {
      const { getUserMonthlyFee } = require('../../models/simple-db');
      
      const fee = getUserMonthlyFee(999);
      
      expect(fee).toBe(110000); // Default fee
    });
  });
});
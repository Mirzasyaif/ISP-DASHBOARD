const mikrotik = {
  connect: jest.fn(() => Promise.resolve(true)),
  
  getActiveUsers: jest.fn(() => Promise.resolve([
    { name: 'USER1', ip: '10.11.1.10', uptime: '1h' },
    { name: 'USER2', ip: '10.11.1.11', uptime: '2h' },
    { name: 'USER3', ip: '10.11.1.12', uptime: '30m' }
  ])),
  
  disconnectUser: jest.fn((username) => Promise.resolve({
    success: true,
    message: `Disconnected ${username}`
  })),
  
  enableUser: jest.fn((username) => Promise.resolve({
    success: true,
    message: `Enabled ${username}`
  })),
  
  disableUser: jest.fn((username) => Promise.resolve({
    success: true,
    message: `Disabled ${username}`
  })),
  
  getSystemResources: jest.fn(() => Promise.resolve({
    cpu: 15,
    memory: 512,
    totalMemory: 1024,
    uptime: '1d 5h 30m'
  }))
};

module.exports = mikrotik;
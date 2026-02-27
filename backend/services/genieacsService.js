/**
 * GenieACS Service Module
 * Menangani komunikasi dengan GenieACS untuk konfigurasi CPE device
 */

const http = require('http');
const https = require('https');
const config = require('../config/config');

/**
 * Membuat request ke GenieACS API
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} path - API path
 * @param {object} data - Data untuk dikirim (untuk POST/PUT)
 * @returns {Promise<object>} Response dari GenieACS
 */
function makeGenieACSRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const genieacsConfig = config.getConfig();
        const url = new URL(path, `${genieacsConfig.genieacs_url}:${genieacsConfig.genieacs_port}`);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        // Add basic auth if credentials are configured
        if (genieacsConfig.genieacs_username && genieacsConfig.genieacs_password) {
            const auth = Buffer.from(
                `${genieacsConfig.genieacs_username}:${genieacsConfig.genieacs_password}`
            ).toString('base64');
            options.headers['Authorization'] = `Basic ${auth}`;
        }
        
        const protocol = url.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = body ? JSON.parse(body) : {};
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(`GenieACS API Error: ${res.statusCode} - ${JSON.stringify(response)}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * Menambahkan device baru ke GenieACS
 * @param {object} deviceData - Data device
 * @returns {Promise<object>} Device ID dan status
 */
async function addDeviceToGenieACS(deviceData) {
    try {
        console.log('📡 Adding device to GenieACS:', deviceData.serial_number);
        
        // Cek apakah device sudah ada berdasarkan serial number
        const existingDevice = await getDeviceBySerial(deviceData.serial_number);
        
        if (existingDevice) {
            console.log('✅ Device already exists in GenieACS:', existingDevice._id);
            return {
                success: true,
                deviceId: existingDevice._id,
                status: 'existing',
                message: 'Device already registered'
            };
        }
        
        // Buat device baru
        const newDevice = {
            _id: deviceData.serial_number,
            oui: deviceData.serial_number.substring(0, 6),
            productClass: deviceData.model || 'unknown',
            serialNumber: deviceData.serial_number,
            inform: true,
            tags: ['pppoe-client']
        };
        
        const response = await makeGenieACSRequest('POST', '/devices/', newDevice);
        
        console.log('✅ Device added to GenieACS:', response._id);
        
        return {
            success: true,
            deviceId: response._id,
            status: 'created',
            message: 'Device successfully added'
        };
        
    } catch (error) {
        console.error('❌ Error adding device to GenieACS:', error.message);
        return {
            success: false,
            error: error.message,
            status: 'failed'
        };
    }
}

/**
 * Mendapatkan device berdasarkan serial number
 * @param {string} serialNumber - Serial number device
 * @returns {Promise<object|null>} Device data atau null
 */
async function getDeviceBySerial(serialNumber) {
    try {
        const response = await makeGenieACSRequest('GET', `/devices/?query={"_id":"${serialNumber}"}`);
        
        if (response && response.length > 0) {
            return response[0];
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error getting device by serial:', error.message);
        return null;
    }
}

/**
 * Konfigurasi PPPoE pada device
 * @param {string} deviceId - Device ID di GenieACS
 * @param {string} username - Username PPPoE
 * @param {string} password - Password PPPoE
 * @returns {Promise<object>} Status konfigurasi
 */
async function configurePPPoE(deviceId, username, password) {
    try {
        console.log('🔧 Configuring PPPoE for device:', deviceId);
        
        // Push parameter values untuk PPPoE
        const parameters = [
            {
                name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
                value: username
            },
            {
                name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
                value: password
            },
            {
                name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable',
                value: true
            }
        ];
        
        const response = await makeGenieACSRequest('POST', `/devices/${deviceId}/tasks`, {
            name: 'setParameterValues',
            parameterValues: parameters
        });
        
        console.log('✅ PPPoE configured for device:', deviceId);
        
        return {
            success: true,
            taskId: response._id,
            message: 'PPPoE configuration sent successfully'
        };
        
    } catch (error) {
        console.error('❌ Error configuring PPPoE:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Konfigurasi WiFi pada device
 * @param {string} deviceId - Device ID di GenieACS
 * @param {string} ssid - SSID WiFi
 * @param {string} password - Password WiFi
 * @returns {Promise<object>} Status konfigurasi
 */
async function configureWiFi(deviceId, ssid, password) {
    try {
        console.log('🔧 Configuring WiFi for device:', deviceId);
        
        // Push parameter values untuk WiFi
        const parameters = [
            {
                name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
                value: ssid
            },
            {
                name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey',
                value: password
            },
            {
                name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType',
                value: 'WPA/WPA2-PSK'
            },
            {
                name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable',
                value: true
            }
        ];
        
        const response = await makeGenieACSRequest('POST', `/devices/${deviceId}/tasks`, {
            name: 'setParameterValues',
            parameterValues: parameters
        });
        
        console.log('✅ WiFi configured for device:', deviceId);
        
        return {
            success: true,
            taskId: response._id,
            message: 'WiFi configuration sent successfully'
        };
        
    } catch (error) {
        console.error('❌ Error configuring WiFi:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Mendapatkan status device
 * @param {string} serialNumber - Serial number device
 * @returns {Promise<object>} Status device
 */
async function getDeviceStatus(serialNumber) {
    try {
        const device = await getDeviceBySerial(serialNumber);
        
        if (!device) {
            return {
                success: false,
                status: 'not_found',
                message: 'Device not found in GenieACS'
            };
        }
        
        return {
            success: true,
            deviceId: device._id,
            status: device._lastInform ? 'online' : 'offline',
            lastInform: device._lastInform,
            tags: device.tags || []
        };
    } catch (error) {
        console.error('❌ Error getting device status:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Proses lengkap: Tambah device dan konfigurasi PPPoE + WiFi
 * @param {object} clientData - Data client lengkap
 * @returns {Promise<object>} Status proses lengkap
 */
async function provisionClient(clientData) {
    try {
        console.log('🚀 Starting client provisioning for:', clientData.pppoe_username);
        
        // 1. Tambah device ke GenieACS
        const deviceResult = await addDeviceToGenieACS({
            serial_number: clientData.cpe_serial_number,
            model: clientData.cpe_model
        });
        
        if (!deviceResult.success) {
            return {
                success: false,
                error: deviceResult.error,
                message: 'Failed to add device to GenieACS'
            };
        }
        
        const deviceId = deviceResult.deviceId;
        
        // 2. Konfigurasi PPPoE
        const pppoeResult = await configurePPPoE(
            deviceId,
            clientData.pppoe_username,
            clientData.pppoe_password || clientData.pppoe_username // Default password sama dengan username
        );
        
        // 3. Konfigurasi WiFi (jika ada data WiFi)
        let wifiResult = { success: true, message: 'WiFi configuration skipped' };
        if (clientData.wifi_ssid && clientData.wifi_password) {
            wifiResult = await configureWiFi(deviceId, clientData.wifi_ssid, clientData.wifi_password);
        }
        
        console.log('✅ Client provisioning completed for:', clientData.pppoe_username);
        
        return {
            success: true,
            deviceId: deviceId,
            deviceStatus: deviceResult.status,
            pppoeConfigured: pppoeResult.success,
            wifiConfigured: wifiResult.success,
            message: 'Client successfully provisioned to GenieACS'
        };
        
    } catch (error) {
        console.error('❌ Error provisioning client:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to provision client to GenieACS'
        };
    }
}

/**
 * Test koneksi ke GenieACS
 * @returns {Promise<object>} Status koneksi
 */
async function testConnection() {
    try {
        const response = await makeGenieACSRequest('GET', '/devices/?limit=1');
        
        return {
            success: true,
            message: 'Successfully connected to GenieACS',
            devicesCount: Array.isArray(response) ? response.length : 0
        };
    } catch (error) {
        console.error('❌ GenieACS connection test failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to connect to GenieACS'
        };
    }
}

module.exports = {
    addDeviceToGenieACS,
    getDeviceBySerial,
    configurePPPoE,
    configureWiFi,
    getDeviceStatus,
    provisionClient,
    testConnection
};

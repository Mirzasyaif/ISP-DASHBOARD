#!/bin/bash

# Start ISP Dashboard server with PM2

cd /home/mirza/cline/ISP-DASHBOARD/backend

echo "Starting ISP Dashboard server..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Starting with npm..."
    npm start
    exit 0
fi

# Check if already running
if pm2 list | grep -q "isp-dashboard"; then
    echo "Server already running. Restarting..."
    pm2 restart isp-dashboard
else
    echo "Starting new server instance..."
    pm2 start index.js --name isp-dashboard
fi

# Save PM2 process list
pm2 save

echo ""
echo "Server status:"
pm2 status isp-dashboard

echo ""
echo "To view logs: pm2 logs isp-dashboard"
echo "To stop: pm2 stop isp-dashboard"
echo "To monitor: pm2 monit"
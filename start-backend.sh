#!/bin/bash
# Startskript för SHL Simulator Backend på tabell.top

# Gå till backend-katalog
cd /path/to/your/website/backend

# Installera npm-paket (första gången)
npm install

# Starta servern i bakgrunden
nohup node server.js > backend.log 2>&1 &

echo "Backend startat på port 3001"
echo "Loggar: backend.log"
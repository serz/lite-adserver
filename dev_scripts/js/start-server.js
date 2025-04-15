#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

// The preferred port for the application
const PREFERRED_PORT = 8787;

/**
 * Check if a port is in use
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} - True if the port is in use, false otherwise
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port);
  });
}

/**
 * Start the wrangler development server
 * @param {number|null} port - The specific port to use, or null for dynamic port
 */
function startServer(port) {
  const args = ['wrangler', 'dev', 'src/workers/index.ts'];
  
  // Add port argument if a specific port is requested
  if (port) {
    args.push('--port', port.toString());
  }

  console.log(`Starting server ${port ? `on port ${port}` : 'with dynamic port'}`);
  
  const wranglerProcess = spawn('npx', args, { 
    stdio: 'inherit',
    shell: true
  });
  
  wranglerProcess.on('error', (err) => {
    console.error('Failed to start wrangler:', err);
    process.exit(1);
  });
}

// Main function to check the preferred port and start the server
async function main() {
  const portBusy = await isPortInUse(PREFERRED_PORT);
  
  if (portBusy) {
    console.warn(`Preferred port ${PREFERRED_PORT} is in use. Using dynamic port assignment instead.`);
    startServer(null);
  } else {
    startServer(PREFERRED_PORT);
  }
}

main().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
}); 
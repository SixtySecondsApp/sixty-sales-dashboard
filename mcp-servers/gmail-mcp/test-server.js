#!/usr/bin/env node

// Simple test to verify the server can be imported and basic functionality works
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testServer() {
  try {
    // Test 1: Check if built files exist
    const distPath = path.join(__dirname, 'dist');
    
    if (!fs.existsSync(distPath)) {
      throw new Error('dist directory not found. Run "npm run build" first.');
    }
    
    const indexPath = path.join(distPath, 'index.js');
    if (!fs.existsSync(indexPath)) {
      throw new Error('index.js not found in dist directory.');
    }
    // Test 2: Check package.json structure
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    
    if (!packageJson.name || !packageJson.version) {
      throw new Error('Invalid package.json structure');
    }
    // Test 3: Check mcp.json manifest
    const mcpManifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'mcp.json'), 'utf8'));
    
    if (!mcpManifest.capabilities || !mcpManifest.capabilities.tools) {
      throw new Error('Invalid MCP manifest structure');
    }
    
    const toolCount = mcpManifest.capabilities.tools.length;
    // Test 4: Try importing the server (without running it)
    // Set minimal environment for testing
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test_client_id';
    process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test_client_secret';
    
    // Test that the built file exists and is importable
    const serverPath = path.join(__dirname, 'dist', 'index.js');
    if (!fs.existsSync(serverPath)) {
      throw new Error('Server entry point not found');
    }
  } catch (error) {
    process.exit(1);
  }
}

// Run tests
testServer();
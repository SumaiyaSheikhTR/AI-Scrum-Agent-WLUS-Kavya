/**
 * CORS Proxy Server for Thomson Reuters OpenAI API
 * 
 * This proxy server allows your localhost React app to communicate with
 * Thomson Reuters internal APIs by bypassing CORS restrictions.
 * 
 * Usage:
 * 1. Run: node cors-proxy-server.js
 * 2. Update your React app to use: http://localhost:8080/proxy instead of the direct URL
 */

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8080;

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'api-key', 'x-tr-chat-profile-name', 'x-tr-userid', 'x-tr-llm-profile-key', 'x-tr-user-sensitivity', 'x-tr-sessionid', 'x-tr-asset-id', 'x-tr-authorization']
}));

// Proxy configuration for Thomson Reuters APIs
const trOpenAIProxy = createProxyMiddleware({
  target: 'https://aiplatform.gcs.int.thomsonreuters.com',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy/token': '/v1/openai/token',
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Proxy response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`❌ Proxy error for ${req.url}:`, err.message);
    res.status(500).json({ 
      error: 'Proxy Error', 
      message: err.message,
      suggestion: 'Ensure you are connected to Thomson Reuters network via VPN'
    });
  }
});

const trBaseProxy = createProxyMiddleware({
  target: 'https://eais2-use.int.thomsonreuters.com',
  changeOrigin: true,
  pathRewrite: {
    '^/proxy/chat': '/openai/deployments',
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`🔄 Proxying ${req.method} ${req.url} -> ${proxyReq.getHeader('host')}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Proxy response: ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`❌ Proxy error for ${req.url}:`, err.message);
    res.status(500).json({ 
      error: 'Proxy Error', 
      message: err.message,
      suggestion: 'Ensure you are connected to Thomson Reuters network via VPN'
    });
  }
});

// Use the proxy middleware
app.use('/proxy/token', trOpenAIProxy);
app.use('/proxy/chat', trBaseProxy);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    proxy: 'Thomson Reuters OpenAI CORS Proxy',
    endpoints: {
      token: 'http://localhost:8080/proxy/token',
      chat: 'http://localhost:8080/proxy/chat'
    }
  });
});

// Root endpoint with instructions
app.get('/', (req, res) => {
  res.json({
    message: 'Thomson Reuters OpenAI CORS Proxy Server',
    status: 'running',
    usage: {
      token_endpoint: 'POST http://localhost:8080/proxy/token',
      chat_endpoint: 'POST http://localhost:8080/proxy/chat/{deployment}/chat/completions',
      health_check: 'GET http://localhost:8080/health'
    },
    note: 'This proxy allows your React app to bypass CORS restrictions when accessing Thomson Reuters internal APIs.'
  });
});

app.listen(PORT, () => {
  console.log('🚀 Thomson Reuters OpenAI CORS Proxy Server Started');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Token Proxy: http://localhost:${PORT}/proxy/token`);
  console.log(`🔗 Chat Proxy: http://localhost:${PORT}/proxy/chat`);
  console.log(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('📋 To use this proxy in your React app:');
  console.log('   1. Update token_url to: http://localhost:8080/proxy/token');
  console.log('   2. Update base_url to: http://localhost:8080/proxy/chat');
  console.log('');
  console.log('⚠️  Note: You must be connected to Thomson Reuters network (VPN) for this to work.');
});

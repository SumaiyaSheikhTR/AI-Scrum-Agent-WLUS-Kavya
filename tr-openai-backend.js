const express = require('express');
const cors = require('cors');
// Using Node.js built-in fetch (Node.js 18+)
const app = express();

// Enable CORS for your React app
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:3005', 'http://localhost:58203'], // Support React ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Thomson Reuters OpenAI Proxy Endpoint
// This does exactly what your Python notebook does, but in Node.js
app.post('/api/tr-openai/token', async (req, res) => {
  try {
    console.log('🔄 Getting Thomson Reuters OpenAI credentials...');
    
    // Allow React app to pass workspace_id, or use correct default
    const { workspace_id = "SumaiyaSheikEgRr", model_name = "gpt-4o" } = req.body;
    
    console.log('🏢 Using workspace_id:', workspace_id);
    
    const payload = {
      workspace_id: workspace_id,
      model_name: model_name
    };

    const url = "https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token";
    
    // Make the request to get credentials (same as your Python notebook)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const credentials = await response.json();
    
    console.log('✅ Thomson Reuters credentials obtained successfully');
    console.log('📋 Credentials structure:', {
      hasOpenaiKey: !!credentials.openai_key,
      hasAzureDeployment: !!credentials.azure_deployment,
      hasToken: !!credentials.token,
      hasApiVersion: !!credentials.openai_api_version,
      keys: Object.keys(credentials)
    });
    
    // Return credentials to your React app
    res.json({
      success: true,
      credentials: credentials
    });

  } catch (error) {
    console.error('❌ Error getting Thomson Reuters credentials:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get Thomson Reuters OpenAI credentials'
    });
  }
});

// Thomson Reuters OpenAI Chat Endpoint
app.post('/api/tr-openai/chat', async (req, res) => {
  try {
    const { credentials, messages, model_name = "gpt-4o", asset_id = "204383" } = req.body;
    
    console.log('🤖 Making Thomson Reuters OpenAI chat request...');
    
    if (!credentials || !credentials.openai_key) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials'
      });
    }

    // Build headers exactly like your Python notebook
    const llm_profile_key = credentials.azure_deployment.split("/")[0];
    const workspace_id = "SumaiyaSheikEgRr";

    const headers = {
      "Authorization": `Bearer ${credentials.token}`,
      "api-key": credentials.openai_key,
      "Content-Type": "application/json",
      "x-tr-chat-profile-name": "ai-platforms-chatprofile-prod",
      "x-tr-userid": workspace_id,
      "x-tr-llm-profile-key": llm_profile_key,
      "x-tr-user-sensitivity": "true",
      "x-tr-sessionid": credentials.azure_deployment,
      "x-tr-asset-id": asset_id,
      "x-tr-authorization": "https://eais2-use.int.thomsonreuters.com"
    };

    // Make the chat request
    const chatUrl = `https://eais2-use.int.thomsonreuters.com/openai/deployments/${credentials.azure_deployment}/chat/completions?api-version=${credentials.openai_api_version}`;
    
    const requestBody = {
      model: model_name,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    };

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Chat API error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Thomson Reuters OpenAI chat response received');
    
    res.json({
      success: true,
      response: result
    });

  } catch (error) {
    console.error('❌ Error in Thomson Reuters chat:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get chat response'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Thomson Reuters OpenAI Backend Service',
    endpoints: {
      token: 'POST /api/tr-openai/token',
      chat: 'POST /api/tr-openai/chat'
    }
  });
});

const PORT = process.env.PORT || 3002; // Changed from 3001 to avoid conflict
app.listen(PORT, () => {
  console.log('🚀 Thomson Reuters OpenAI Backend Service Started');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔗 Token API: http://localhost:${PORT}/api/tr-openai/token`);
  console.log(`🔗 Chat API: http://localhost:${PORT}/api/tr-openai/chat`);
  console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('✅ This backend replicates your Python notebook functionality!');
  console.log('✅ Your React app can now call these APIs without CORS issues.');
});

module.exports = app;

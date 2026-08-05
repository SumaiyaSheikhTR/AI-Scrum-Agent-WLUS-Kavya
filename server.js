const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const { WebSocket } = require('ws');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: '.env.development' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Configure CORS to allow requests from the React app
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add additional CORS headers for preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
// Increase the limit for JSON body parser to handle larger requests
app.use(bodyParser.json({ limit: '10mb' }));
// Add compression to reduce payload size
app.use(compression());

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

// Sentiment Analysis API endpoint
app.post('/api/sentiment-analysis', async (req, res) => {
  try {
    const { text } = req.body;
    
    //console.log('Sentiment analysis request received for text:', text);
    //console.log('Using Hugging Face API key:', process.env.HUGGINGFACE_API_KEY ? 'Key is set' : 'Key is not set');
    
    if (!text) {
      //console.log('Error: Text is required');
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // For very long text, truncate to avoid request header size issues
    const truncatedText = text.length > 500 ? text.substring(0, 500) + "..." : text;
    //console.log('Using text (possibly truncated):', truncatedText);
    
    // Call the Hugging Face Inference API for sentiment analysis
    // Using the cardiffnlp/twitter-roberta-base-sentiment model
    //console.log('Calling Hugging Face API...');
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment',
      { inputs: truncatedText },
      {
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    //console.log('Hugging Face API response received:', response.data);
    
    // Process the response
    // The model returns an array of objects with label and score
    const result = response.data[0];
    
    // Map the labels to our sentiment format
    // The model returns LABEL_0 (negative), LABEL_1 (neutral), LABEL_2 (positive)
    const sentimentMap = {
      'LABEL_0': 'negative',
      'LABEL_1': 'neutral',
      'LABEL_2': 'positive'
    };
    
    // Find the label with the highest score
    let highestScore = 0;
    let highestLabel = '';
    
    for (const item of result) {
      if (item.score > highestScore) {
        highestScore = item.score;
        highestLabel = item.label;
      }
    }
    
    // Map the sentiment score to a range from -1 to 1
    // LABEL_0 (negative): -1 to -0.33
    // LABEL_1 (neutral): -0.33 to 0.33
    // LABEL_2 (positive): 0.33 to 1
    let normalizedScore = 0;
    
    if (highestLabel === 'LABEL_0') {
      // Negative: map from 0-1 to -1-(-0.33)
      normalizedScore = -1 + (highestScore * 0.67);
    } else if (highestLabel === 'LABEL_1') {
      // Neutral: map from 0-1 to -0.33-0.33
      normalizedScore = -0.33 + (highestScore * 0.66);
    } else if (highestLabel === 'LABEL_2') {
      // Positive: map from 0-1 to 0.33-1
      normalizedScore = 0.33 + (highestScore * 0.67);
    }
    
    // Extract keywords using simple frequency analysis
    const words = text.toLowerCase().split(/\W+/).filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'have', 'were', 'they', 'will', 'what', 'when', 'where', 'which'].includes(word)
    );
    
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Sort by frequency and take top 5
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    // Create a brief summary
    const sentiment = sentimentMap[highestLabel] || 'neutral';
    const summary = `The text expresses ${sentiment} sentiment with ${Math.round(highestScore * 100)}% confidence.`;
    
    res.json({
      sentiment,
      score: normalizedScore,
      confidence: highestScore,
      keywords,
      summary
    });
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    res.status(500).json({ 
      error: 'Failed to analyze sentiment',
      details: error.message
    });
  }
});

// OpenArena API endpoint
app.post('/api/openarena', async (req, res) => {
  try {
    const { query, workflow_id, is_persistence_allowed } = req.body;
    
    // Validate and limit query size to prevent large headers
    if (query && query.length > 5000) {
      return res.status(413).json({ 
        error: 'Query too large. Please limit your request to 5000 characters.' 
      });
    }
    
    // Get token from environment variables
    const ESSO_TOKEN = process.env.REACT_APP_OPENARENA_ESSO_TOKEN;
    const URL = `wss://wymocw0zke.execute-api.us-east-1.amazonaws.com/prod/?Authorization=${ESSO_TOKEN}`;
    
    // Use the workflow ID from the request or fallback to the default
    const workflowId = workflow_id || process.env.REACT_APP_OPENARENA_WORKFLOW_ID || "2db16fb7-64d1-4d44-b250-8cb95fced357";
    
    // Use the persistence flag from the request or fallback to the default
    const isPersistenceAllowed = is_persistence_allowed !== undefined 
      ? is_persistence_allowed 
      : (process.env.REACT_APP_OPENARENA_PERSISTENCE_ALLOWED === 'true');
    
    // Connect to OpenArena WebSocket
    const ws = new WebSocket(URL);
    
    // Wait for connection to open
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    
    // Send the message
    const msg = JSON.stringify({
      action: "SendMessage",
      workflow_id: workflowId,
      query: query,
      is_persistence_allowed: isPersistenceAllowed
    });
    
    ws.send(msg);
    
    // Process the response
    let answer = '';
    let costTracker = {};
    
    await new Promise((resolve, reject) => {
      ws.on('message', (message) => {
        try {
          const parsedMessage = JSON.parse(message);
          
          for (const model in parsedMessage) {
            if (parsedMessage[model].answer) {
              answer += parsedMessage[model].answer;
            } else if (parsedMessage[model].cost_track) {
              costTracker = parsedMessage[model].cost_track;
              resolve();
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
      
      // Set a timeout in case the response never completes
      setTimeout(() => {
        reject(new Error('WebSocket response timeout'));
      }, 30000); // 30 seconds timeout
    });
    
    // Close the WebSocket
    ws.close();
    
    // Send the response
    res.json({
      answer,
      cost_tracker: costTracker
    });
  } catch (error) {
    console.error('Error querying OpenArena:', error);
    res.status(500).json({ error: 'Failed to query OpenArena' });
  }
});

// Azure DevOps Proxy Endpoints
// These endpoints proxy requests to Azure DevOps to avoid CORS issues

// Proxy for WIQL queries
app.post('/api/ado-proxy/wiql', async (req, res) => {
  try {
    const { organization, project, query, top = 200 } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!organization || !project || !query) {
      return res.status(400).json({ 
        error: 'Missing required parameters: organization, project, query' 
      });
    }

    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/wiql`;
    const response = await axios.post(url, 
      { query }, 
      {
        params: {
          'api-version': '7.0',
          '$top': top
        },
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO WIQL proxy:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to execute WIQL query' 
    });
  }
});

// Proxy for getting work items by IDs
app.post('/api/ado-proxy/workitems', async (req, res) => {
  try {
    const { organization, project, ids, fields } = req.body;
    
    console.log('ADO workitems proxy request:', {
      organization,
      project,
      ids: Array.isArray(ids) ? ids : [ids],
      idsCount: Array.isArray(ids) ? ids.length : 1,
      fields
    });
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      console.error('ADO PAT not configured');
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!organization || !project || !ids) {
      console.error('Missing required parameters:', { organization, project, ids });
      return res.status(400).json({ 
        error: 'Missing required parameters: organization, project, ids' 
      });
    }

    const url = `https://dev.azure.com/${organization}/${project}/_apis/wit/workitems`;
    const idsParam = Array.isArray(ids) ? ids.join(',') : ids;
    
    console.log('Making ADO API call:', {
      url,
      idsParam,
      note: 'Using $expand=relations (gets all default fields + relations data)'
    });
    
    const response = await axios.get(url, {
      params: {
        'api-version': '7.0',
        ids: idsParam,
        // Note: Cannot use both fields and $expand together in ADO API
        // When expanding relations, we get all default fields automatically
        '$expand': 'relations'
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('ADO API success:', {
      status: response.status,
      dataCount: response.data?.value?.length || 0
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO work items proxy:');
    console.error('- Message:', error.message);
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);
    console.error('- Data:', error.response?.data);
    console.error('- Request URL:', error.config?.url);
    console.error('- Request Params:', error.config?.params);
    
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch work items',
      details: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message
      }
    });
  }
});

// Proxy for creating a work item (JSON Patch document built by the client)
app.post('/api/ado-proxy/workitems/create', async (req, res) => {
  try {
    const { organization, project, type, document, apiVersion = '7.0' } = req.body;

    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;

    if (!pat) {
      return res.status(500).json({
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.'
      });
    }

    if (!organization || !project || !type || !Array.isArray(document) || document.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters: organization, project, type, document[]'
      });
    }

    const url = `https://dev.azure.com/${organization}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(type)}`;

    console.log('ADO create work item proxy request:', { url, fields: document.length });

    const response = await axios.post(url, document, {
      params: {
        'api-version': apiVersion
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json-patch+json'
      }
    });

    // An unauthenticated request is answered with an HTML sign-in page and
    // HTTP 200, so the payload has to be checked instead of the status code.
    if (!response.data || typeof response.data !== 'object' || response.data.id === undefined) {
      return res.status(401).json({
        error: 'Azure DevOps did not return a created work item. Check that REACT_APP_ADO_PAT is valid and has work item write access.'
      });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO create work item proxy:');
    console.error('- Message:', error.message);
    console.error('- Status:', error.response?.status);
    console.error('- Data:', error.response?.data);

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.response?.data || 'Failed to create work item'
    });
  }
});

// Proxy for getting repositories
app.post('/api/ado-proxy/repositories', async (req, res) => {
  try {
    const { organization, project } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!organization || !project) {
      return res.status(400).json({ 
        error: 'Missing required parameters: organization, project' 
      });
    }

    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories`;
    const response = await axios.get(url, {
      params: {
        'api-version': '7.0'
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO repositories proxy:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch repositories' 
    });
  }
});

// Proxy for getting pull requests
app.post('/api/ado-proxy/pullrequests', async (req, res) => {
  try {
    const { organization, project, repositoryId, status = 'all', top = 100 } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!organization || !project || !repositoryId) {
      return res.status(400).json({ 
        error: 'Missing required parameters: organization, project, repositoryId' 
      });
    }

    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests`;
    const response = await axios.get(url, {
      params: {
        'api-version': '7.0',
        'searchCriteria.status': status,
        '$top': top
      },
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO pull requests proxy:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch pull requests' 
    });
  }
});

// Proxy for getting team members
app.post('/api/ado-proxy/teams', async (req, res) => {
  try {
    const { config, endpoint } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter' 
      });
    }

    const url = `https://dev.azure.com/${endpoint}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO teams proxy:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch team members' 
    });
  }
});

// Proxy for getting sprint iterations
app.post('/api/ado-proxy/sprints', async (req, res) => {
  try {
    const { config, endpoint } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter' 
      });
    }

    const url = `https://dev.azure.com/${endpoint}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO sprints proxy:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch sprint data' 
    });
  }
});

// Proxy for getting team capacity
app.post('/api/ado-proxy/capacity', async (req, res) => {
  try {
    const { config, endpoint } = req.body;
    
    // Get PAT from environment variables
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      return res.status(500).json({ 
        error: 'ADO PAT not configured. Please set REACT_APP_ADO_PAT in environment variables.' 
      });
    }
    
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter' 
      });
    }

    const url = `https://dev.azure.com/${endpoint}`;
    console.log('🔍 CAPACITY_PROXY: Fetching from URL:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 CAPACITY_PROXY: Response status:', response.status);
    console.log('🔍 CAPACITY_PROXY: Response structure:', {
      hasValue: !!response.data?.value,
      valueLength: response.data?.value?.length || 0,
      responseKeys: Object.keys(response.data || {}),
      fullResponse: JSON.stringify(response.data, null, 2)
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error in ADO capacity proxy:', error.message);
    console.error('Error response data:', error.response?.data);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data || 'Failed to fetch capacity data' 
    });
  }
});

/**
 * Email delivery endpoint used by automation (daily summaries, alerts, tests).
 * Uses nodemailer when available + SMTP config is provided; otherwise accepts
 * and logs the message so the automation pipeline remains observable.
 */
app.post('/api/email', async (req, res) => {
  try {
    const { to, subject, html, text, smtp } = req.body || {};

    if (!to || !Array.isArray(to) || to.length === 0 || !subject) {
      return res.status(400).json({ success: false, error: 'to[] and subject are required' });
    }

    console.log(`[EMAIL] To: ${to.join(', ')} | Subject: ${subject}`);

    if (smtp && smtp.host && smtp.user) {
      try {
        // Optional dependency — load dynamically so the server still boots without it
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port || 587,
          secure: !!smtp.secure,
          auth: {
            user: smtp.user,
            pass: smtp.pass,
          },
        });

        const info = await transporter.sendMail({
          from: smtp.from || smtp.user,
          to: to.join(', '),
          subject,
          text: text || '',
          html: html || text || '',
        });

        return res.json({ success: true, mode: 'smtp', messageId: info.messageId });
      } catch (smtpError) {
        console.error('[EMAIL] SMTP send failed, falling back to log mode:', smtpError.message);
      }
    }

    // Log / queue mode when SMTP is not configured
    return res.json({
      success: true,
      mode: 'logged',
      message: 'Email logged on server (SMTP not configured or unavailable)',
      preview: {
        to,
        subject,
        textLength: (text || '').length,
        htmlLength: (html || '').length,
      },
    });
  } catch (error) {
    console.error('[EMAIL] Unexpected error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process email' });
  }
});

// Catch-all handler for production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

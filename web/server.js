import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import express from 'express';
import { restResources } from '@shopify/shopify-api/rest/admin/2026-04';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Get hostname from environment or use Fly.io app name
const hostName = process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 
                 (process.env.FLY_APP_NAME ? `${process.env.FLY_APP_NAME}.fly.dev` : 'localhost:3000');

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: process.env.SCOPES?.split(',') || [],
  hostName: hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  restResources,
});

// Health check endpoint (required by Fly.io)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shopify Checkout Custom Extension App',
    status: 'running',
    app: 'shopifycheckoutandprofileapp'
  });
});

// OAuth initiation handler
app.get('/api/auth', async (req, res) => {
  try {
    if (!req.query.shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    const authRoute = await shopify.auth.begin({
      shop: req.query.shop,
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
    
    res.redirect(authRoute);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// OAuth callback handler
app.get('/api/auth/callback', async (req, res) => {
  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;
    // TODO: Store session in your database here
    
    const redirectUrl = req.query.host 
      ? `https://${req.query.host}/apps/${process.env.SHOPIFY_API_KEY}`
      : `/?shop=${session.shop}&host=${req.query.host}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ error: 'Callback failed', details: error.message });
  }
});

// API routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Shopify App API',
    version: '1.0.0',
    endpoints: ['/health', '/api/auth', '/api/auth/callback']
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Hostname: ${hostName}`);
});


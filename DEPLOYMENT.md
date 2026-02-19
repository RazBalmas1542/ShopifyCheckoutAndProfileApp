# Fly.io Deployment Guide

This guide will help you deploy your Shopify app to Fly.io.

## Prerequisites

1. Install Fly.io CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   flyctl auth login
   ```

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables in Fly.io

Set your Shopify app credentials as secrets in Fly.io:

```bash
flyctl secrets set SHOPIFY_API_KEY=your_api_key
flyctl secrets set SHOPIFY_API_SECRET=your_api_secret
flyctl secrets set SCOPES=read_products,write_products
flyctl secrets set SHOPIFY_APP_URL=https://shopifycheckoutandprofileapp.fly.dev
```

### 3. Deploy to Fly.io

```bash
flyctl deploy
```

Or use the npm script:
```bash
npm run deploy:fly
```

### 4. Verify Deployment

Check your app status:
```bash
flyctl status
```

View logs:
```bash
flyctl logs
```

### 5. Update Shopify App Settings

1. Go to your [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Navigate to your app
3. Update the App URL to: `https://shopifycheckoutandprofileapp.fly.dev`
4. Update the Allowed redirection URL(s) to include: `https://shopifycheckoutandprofileapp.fly.dev/api/auth`

## App URL

Your app will be available at: `https://shopifycheckoutandprofileapp.fly.dev`

## Health Check

The health check endpoint is available at: `https://shopifycheckoutandprofileapp.fly.dev/health`

## Troubleshooting

- Check logs: `flyctl logs`
- SSH into the app: `flyctl ssh console`
- View app info: `flyctl status`
- Restart the app: `flyctl apps restart shopifycheckoutandprofileapp`


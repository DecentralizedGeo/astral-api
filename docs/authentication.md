---
id: authentication
title: Authentication
sidebar_label: Authentication
slug: /authentication
---

# Authentication

The Astral Protocol API currently operates with public read access and does not require authentication for most endpoints. This document outlines the current authentication approach and future plans.

## Current Authentication Model

### Public Access Endpoints

Most endpoints in the Astral API are publicly accessible without authentication:

- `/health` - Health check endpoint
- `/` - API root information
- `/api/v0/config` - API configuration
- `/api/v0/location-proofs` - Location proofs queries
- `/api/v0/location-proofs/:uid` - Individual location proof retrieval
- `/api/v0/location-proofs/stats` - Statistics on location proofs

### Restricted Endpoints

Some endpoints that trigger actions or control the system are currently restricted to serverless functions and cron triggers:

- `/api/sync` - Trigger synchronization of attestations
- `/api/sync/status` - Get synchronization status
- `/api/sync/revocations` - Trigger revocation checks
- `/api/sync/worker` - Control the background worker

These endpoints are protected through Vercel's internal mechanisms rather than API keys or tokens.

## Planned Authentication Features

In future releases, the API will implement more robust authentication mechanisms:

1. **API Key Authentication**: For basic API access, enabling rate limiting and usage tracking
2. **JWT Authentication**: For user-specific operations and accessing private data
3. **OAuth 2.0**: For third-party integration and delegation of access

### API Key Authentication

API keys will be implemented for general API access, allowing:

- Basic authentication for API calls
- Rate limiting based on API key
- Usage tracking and analytics
- Different tiers of access (e.g., basic, premium)

Example API key usage (future implementation):

```bash
curl -H "X-API-Key: your_api_key_here" https://api.astral.global/api/v0/location-proofs
```

### JWT Authentication

JSON Web Token (JWT) authentication will be used for user-specific operations:

- User authentication and authorization
- Access to user-specific data
- Operation on behalf of a user

Example JWT usage (future implementation):

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." https://api.astral.global/api/v0/my-location-proofs
```

### Wallet-Based Authentication

As the Astral Protocol is blockchain-based, wallet signature authentication will be supported:

- Sign a message with your Ethereum wallet
- Verify ownership of a blockchain address
- Access to attestations created by your address

## API Key Management

When API keys are implemented, they will be managed through a dedicated portal:

1. Register for an API key through the developer portal
2. Select the appropriate tier based on your needs
3. Generate and manage API keys
4. View usage statistics and rate limits

## Best Practices

Even though authentication is not currently required, we recommend implementing your code with authentication in mind for future compatibility:

```javascript
// Example: Authentication-ready API client
class AstralApiClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://api.astral.global';
    this.apiKey = config.apiKey || null;
  }

  async getLocationProofs(params = {}) {
    const url = new URL(`${this.baseUrl}/api/v0/location-proofs`);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authentication when available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return response.json();
  }
}
```

## Security Considerations

When working with the API:

1. Keep your API keys secure and do not expose them in client-side code
2. Implement proper token storage and refresh mechanisms
3. Use HTTPS for all API requests
4. Regularly rotate your API keys
5. Only request the permissions you need

## Rate Limiting

While authentication is not currently required, the API may implement rate limiting based on IP address. In the future, authenticated requests will have higher rate limits than unauthenticated ones.

Current limits:
- Unauthenticated requests: 100 requests per minute
- Authenticated requests: To be determined based on tier

## Feedback

We welcome feedback on our authentication plans. If you have specific requirements or suggestions, please:

1. Create an issue in the [GitHub repository](https://github.com/DecentralizedGeo/astral-api)
2. Reach out through our [community channels](https://github.com/DecentralizedGeo/astral-api)


import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Astral API is running' });
});

// Add a placeholder for the root endpoint (will be OGC API landing page)
app.get('/', (req, res) => {
  res.status(200).json({
    title: 'Astral Protocol Location Proof API',
    description: 'API for querying location proof attestations across multiple blockchains',
    links: [
      {
        rel: 'self',
        href: '/',
        type: 'application/json'
      },
      {
        rel: 'service-desc',
        href: '/api',
        type: 'application/json' 
      },
      {
        rel: 'conformance',
        href: '/conformance',
        type: 'application/json'
      },
      {
        rel: 'data',
        href: '/collections',
        type: 'application/json'
      }
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
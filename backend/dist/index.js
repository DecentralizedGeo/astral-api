"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json());
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
//# sourceMappingURL=index.js.map
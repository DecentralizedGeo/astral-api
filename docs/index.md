---
id: introduction
title: Astral Protocol API Documentation
sidebar_label: Introduction
slug: /docs
---

# Astral Protocol API Documentation

Welcome to the Astral Protocol API documentation. This API provides access to location proof attestations across multiple blockchains, allowing developers to query, validate, and work with geographic location data that has been verified on the blockchain.

## What is Astral Protocol?

Astral Protocol is a system for creating, storing, and verifying location proofs on the blockchain. These proofs are stored as attestations using the Ethereum Attestation Service (EAS) and can be queried through this API.

## Key Features

- **Multi-Chain Support**: Query location proofs from Arbitrum, Base, Celo, and Sepolia
- **Spatial Queries**: Find location proofs within specific geographic areas
- **Real-Time Syncing**: Automatic synchronization with blockchain data every minute
- **Revocation Checking**: Verify if location proofs have been revoked
- **GeoJSON Support**: Work with standard GeoJSON location data

## API Overview

The Astral API is a RESTful API that provides endpoints for:

1. Querying location proofs with various filters
2. Retrieving specific location proofs by their unique identifier
3. Getting statistics about available location proofs
4. Triggering and monitoring blockchain synchronization
5. Checking the status of the API and sync process

## Getting Started

To start using the Astral API:

1. Check out the [Getting Started Guide](./getting-started.md) for a quick introduction
2. Read the [API Reference](./api-reference.md) for detailed endpoint information
3. Explore the [Data Model](./data-model.md) to understand location proof structure

## Example Use Cases

The Astral API enables numerous applications, including:

- **Supply Chain Verification**: Track and verify the geographic journey of goods
- **Environmental Monitoring**: Record and verify location data for environmental observations
- **Decentralized Mapping**: Build maps with verified location data
- **Proof-of-Presence**: Verify that someone or something was at a specific location
- **Geospatial Data Markets**: Create marketplaces for verified location data
- **Gaming**: Enable location-based gameplay with verifiable locations

## Documentation Contents

This documentation is organized into the following sections:

- **Introduction**: Overview of the Astral Protocol API (this page)
- **[Getting Started](./getting-started.md)**: Quick start guide for using the API
- **[API Reference](./api-reference.md)**: Detailed information about all API endpoints
- **[Data Model](./data-model.md)**: Overview of the location proof data model
- **[Spatial Queries](./spatial-queries.md)**: Guide to geographic filtering capabilities
- **[Authentication](./authentication.md)**: Information about authentication (future)
- **[Troubleshooting](./troubleshooting.md)**: Solutions to common issues

## Support and Community

If you have questions or need help:

- Check the [Troubleshooting Guide](./troubleshooting.md) for solutions to common problems
- Create an issue in the [GitHub repository](https://github.com/DecentralizedGeo/astral-api)
- Join our community channels for discussion and support

## Contributing

We welcome contributions to both the API and its documentation:

1. Check existing [issues](https://github.com/DecentralizedGeo/astral-api/issues) or create a new one
2. Fork the repository and create a feature branch
3. Make your changes and submit a pull request
4. Join the community discussion to share ideas and feedback

## License

The Astral Protocol API is open source and available under MIT license.
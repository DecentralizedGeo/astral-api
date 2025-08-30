# Astral API Tests

This directory contains tests for the Astral API backend, organized to match the core functionality.

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test -- tests/api/
npm test -- tests/services/
npm test -- tests/integration/

# Run specific test
npm test -- -t "test name"

# Run tests in watch mode
npm run test:watch
```

## Test Structure

Tests are organized to match the API structure and core functionality:

- `api/` - Tests for API endpoints and controllers
- `core/` - Tests for core business logic and models
- `eas/` - Tests for EAS (Ethereum Attestation Service) integration
- `services/` - Tests for service layer (database, external APIs)
- `integration/` - End-to-end integration tests
- `setup/` - Test configuration and utilities
- `manual/` - Manual testing scripts and debugging tools (not automated)

## Testing Strategy

Our testing approach focuses on core functionality with practical coverage:

### Unit Tests

- **API Controllers**: Test request/response handling and validation
- **Services**: Test business logic with mocked dependencies
- **Models**: Test data validation and transformation
- **EAS Integration**: Test attestation creation and verification

### Integration Tests

- **Database Operations**: Test real database interactions
- **API Endpoints**: Test complete request flows
- **External Services**: Test EAS and Supabase integration

### Coverage Goals

- Focus on **core functionality** rather than 100% coverage
- Ensure **critical paths** are well tested
- Test **error handling** and edge cases
- Validate **data integrity** and **security**

## Test Utilities

Common test utilities and helpers are located in `setup/`:

- Database test setup
- Mock configurations
- Test data factories
- Helper functions

## Key Testing Principles

1. **Production Ready**: Tests ensure API is ready for production use
2. **Core Focus**: Prioritize testing core location proof functionality
3. **Practical Coverage**: Aim for meaningful tests, not just coverage metrics
4. **Clear Organization**: Tests mirror the source code structure
5. **Maintainable**: Tests are easy to understand and modify

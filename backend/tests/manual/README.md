# Manual Test Scripts

This directory contains manual testing scripts and debugging utilities that are **not part of the automated test suite**. These scripts are used for:

- Manual testing of specific functionality
- Debugging and troubleshooting
- Development utilities
- Feature exploration outside core functionality

## Directory Structure

- `debug/` - Debugging scripts for troubleshooting issues
- `utilities/` - General testing utilities and helpers

## Usage

These scripts are designed to be run manually during development:

```bash
# Run a specific debug script
npx ts-node tests/manual/debug/eas-endpoints.ts

# Run a utility script
npx ts-node tests/manual/utilities/test-db-connection.ts
```

## Important Notes

- **Not included in automated test runs**: These scripts are excluded from Jest
- **Not included in coverage**: These don't count toward test coverage metrics
- **Manual execution only**: These require manual setup and execution
- **Development focused**: These are tools for developers, not production tests

## Categories

### Debug Scripts

- EAS endpoint debugging
- Database connection testing
- API endpoint validation
- Service integration testing

### Utilities

- Database setup helpers
- Mock data generators
- Performance testing tools
- Configuration validators

## Adding New Scripts

When adding new manual test scripts:

1. Choose the appropriate subdirectory (`debug/` or `utilities/`)
2. Use descriptive filenames (e.g., `debug-eas-service.ts`)
3. Include clear documentation in the script
4. Ensure scripts are self-contained and don't affect production data

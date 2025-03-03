# Astral Protocol API Development Guide

## Commands
- **Start Local Dev**: `docker compose up`
- **Run Tests**: `npm test`
- **Run Single Test**: `npm test -- -t "test name"`
- **Lint**: `npm run lint`
- **Type Check**: `npm run typecheck`
- **Build**: `npm run build`

## Code Standards
- **Language**: TypeScript with strict typing
- **Formatting**: Prettier with 2-space indentation
- **Imports**: Group by external, internal, then relative paths
- **Naming**: camelCase for variables/functions, PascalCase for classes/interfaces
- **API Responses**: Follow OGC API Features standard for REST; Apollo best practices for GraphQL
- **Error Handling**: Use custom error classes with descriptive messages
- **Database**: Use parameterized queries; PostGIS for geometry operations
- **Documentation**: JSDoc for functions, classes, and interfaces

## Version Control
- Create a new commit for each task in the implementation plan
- Write detailed commit messages explaining what was implemented and why
- Include references to the implementation plan phase and task number

## Verification Before Commit
- **Verify Type Checking**: Run `npm run typecheck` to ensure no type errors
- **Verify Linting**: Run `npm run lint` to ensure code style consistency
- **Verify Build**: Run `npm run build` to ensure code compiles successfully
- **Verify Functionality**: Test key functionality via Docker Compose or local development
- **Documentation**: Update or add documentation for new features
- **Review Changes**: Use `git diff --staged` to review all changes before committing
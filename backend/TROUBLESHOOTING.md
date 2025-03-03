# Troubleshooting Vercel Deployment

This guide helps you troubleshoot common issues when deploying the Astral API to Vercel.

## Build Failures

### TypeScript Errors

If you encounter TypeScript errors during build:

1. **Missing TypeScript declarations**:
   ```
   Error: Could not find a declaration file for module 'pg'
   ```
   
   **Solution**: Install the missing type declarations:
   ```
   npm install --save-dev @types/pg @types/supertest
   ```

2. **Missing Environment Variables in Type Definitions**:
   ```
   Error: Property 'EAS_SCHEMA_RAW_STRING' does not exist on type...
   ```
   
   **Solution**: Ensure the property is properly defined in `src/config/index.ts`.

3. **Method Name Mismatches**:
   ```
   Property 'checkRevocations' does not exist on type 'EasService'
   ```
   
   **Solution**: Check method names in the service classes and ensure you're using the correct method names (e.g., `checkRevocationStatus` instead of `checkRevocations`).

### Missing Dependencies

If you see errors related to missing dependencies:

1. **Dependency not installed**:
   ```
   Cannot find module '@supabase/supabase-js'
   ```
   
   **Solution**: Install the missing dependency:
   ```
   npm install @supabase/supabase-js
   ```

2. **Peer Dependencies**:
   ```
   Warning: unmet peer dependency...
   ```
   
   **Solution**: Install the required peer dependency:
   ```
   npm install --save-peer <dependency-name>
   ```

## Runtime Errors

### Database Connection Issues

If the API fails to connect to the database:

1. **Incorrect Database URL**:
   ```
   Error: password authentication failed for user...
   ```
   
   **Solution**: Double-check the `DATABASE_URL` environment variable in Vercel.

2. **Supabase Permissions**:
   ```
   Error: permission denied for table location_proofs
   ```
   
   **Solution**: Ensure you're using the Service Role key, not the anon key, for write operations.

### Cron Job Not Running

If the cron job isn't running automatically:

1. **Cron Job Not Enabled**:
   - Go to Vercel project settings
   - Navigate to "Cron Jobs" in the sidebar
   - Ensure the cron job is enabled

2. **Incorrect Cron Schedule**:
   - Verify the cron job schedule is set to `*/15 * * * *` for every 15 minutes

### Function Timeout

If functions are timing out:

1. **Vercel Function Timeout**:
   ```
   Error: Function execution timed out
   ```
   
   **Solution**: Vercel has a 10-second execution limit for serverless functions on the free tier. Consider:
   - Optimizing your code for faster execution
   - Processing smaller batches of data
   - Upgrading to a paid plan for longer execution limits
   - Moving intensive operations to a dedicated server

## Debugging Tips

1. **Add Debug Logs**:
   ```javascript
   logger.debug('Debugging variable:', variableName);
   ```

2. **Check Vercel Logs**:
   - Go to your project in the Vercel dashboard
   - Click on the latest deployment
   - Navigate to the "Functions" tab to see function logs

3. **Test Locally First**:
   ```bash
   npm run build
   npm start
   ```

4. **Verify Environment Variables**:
   - In the Vercel dashboard, go to project settings
   - Check the "Environment Variables" section
   - Ensure all required variables are set correctly

## Getting Additional Help

If you're still having issues:

1. Check the Vercel documentation: https://vercel.com/docs
2. Review the Supabase documentation: https://supabase.com/docs
3. Create an issue in the project repository: https://github.com/your-repo/issues
4. Reach out to the project maintainers for assistance
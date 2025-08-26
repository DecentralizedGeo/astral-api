import dotenv from 'dotenv';
import { Pool } from 'pg';
import runMigrations from '../migrations/run-migrations';
import { SchemaValidator } from './validate-schema';

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env' });

/**
 * Function to test the database connection
 */
async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Function to enable PostGIS extension
 */
async function enablePostGIS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Enabling PostGIS extension...');

    const client = await pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      console.log('PostGIS extension enabled successfully');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error enabling PostGIS:', error);
    return false;
  } finally {
    await pool.end();
  }
}

/**
 * Function to check database readiness and suggest recovery steps
 */
async function checkDatabaseReadiness() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    try {
      // Check if PostGIS is available
      const postgisResult = await client.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'postgis'
        ) as postgis_enabled;
      `);

      // Check if location_proofs table exists
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'location_proofs'
        ) as table_exists;
      `);

      return {
        postgis_enabled: postgisResult.rows[0].postgis_enabled,
        table_exists: tableResult.rows[0].table_exists,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error checking database readiness:', error);
    return { postgis_enabled: false, table_exists: false };
  } finally {
    await pool.end();
  }
}
async function verifySetup() {
  const validator = new SchemaValidator();

  try {
    console.log('Verifying database schema...');
    const differences = await validator.validateSchema();

    if (differences.length === 0) {
      console.log('✅ Database schema verification passed');
      return true;
    } else {
      console.log('⚠️  Schema differences found after setup:');
      validator.printDifferences(differences);
      return false;
    }
  } catch (error) {
    console.error('Error during schema verification:', error);
    return false;
  } finally {
    await validator.close();
  }
}
async function setup() {
  try {
    // Test connection first
    const connectionSuccess = await testConnection();
    if (!connectionSuccess) {
      console.error('Aborting setup due to failed database connection.');
      process.exit(1);
    }

    // Enable PostGIS extension
    const postgisSuccess = await enablePostGIS();
    if (!postgisSuccess) {
      console.error('Failed to enable PostGIS extension, but continuing...');
    }

    // Run migrations
    await runMigrations();
    
    // Verify the setup was successful
    const verificationSuccess = await verifySetup();
    if (!verificationSuccess) {
      console.error('⚠️  Database setup completed with schema differences. Please check the output above.');
      process.exit(1);
    }

    console.log('Database setup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setup();
}

// Export individual functions for testing
export { testConnection, enablePostGIS, verifySetup, checkDatabaseReadiness, setup as setupDatabase };
export { runMigrations };
export default setup;
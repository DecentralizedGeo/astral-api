import dotenv from 'dotenv';
import { Pool } from 'pg';
import runMigrations from '../migrations/run-migrations';

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
 * Main setup function
 */
async function setup() {
  try {
    // Test connection first
    const connectionSuccess = await testConnection();
    if (!connectionSuccess) {
      console.error('Aborting setup due to failed database connection.');
      process.exit(1);
    }

    // Run migrations
    await runMigrations();
    
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

export default setup;
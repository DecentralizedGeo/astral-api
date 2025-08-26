import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { SchemaValidator } from '../scripts/validate-schema';

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env' });

const runMigrations = async () => {
  // Create a connection pool to the database with better configuration for session pooler
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2, // Limit concurrent connections for session pooler
    idleTimeoutMillis: 10000, // Close idle connections quickly
    connectionTimeoutMillis: 5000, // Shorter connection timeout
  });

  try {
    console.log('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Get already applied migrations
    const { rows: appliedMigrations } = await pool.query(
      'SELECT name FROM migrations ORDER BY id ASC'
    );
    const appliedMigrationNames = appliedMigrations.map((m) => m.name);

    // Get all migration files
    const migrationsDir = __dirname;
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Ensure order by filename

    // Run migrations that haven't been applied yet
    for (const file of migrationFiles) {
      if (appliedMigrationNames.includes(file)) {
        console.log(`Migration ${file} already applied, skipping...`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Start a transaction for this migration
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        
        // Record that this migration has been applied
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        
        await client.query('COMMIT');
        console.log(`Migration ${file} applied successfully.`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error applying migration ${file}:`, error);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export default runMigrations;
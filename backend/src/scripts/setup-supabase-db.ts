import { supabaseService } from '../services/supabase.service';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function setupSupabaseDb() {
  console.log('Setting up Supabase database...');
  
  try {
    // Initialize Supabase client
    const client = supabaseService.initialize();

    // Initialize helper to check if a table exists
    async function tableExists(tableName: string): Promise<boolean> {
      if (!client) throw new Error('Supabase client not initialized');
      const { data, error } = await client.rpc('execute_sql', {
        sql: `SELECT to_regclass('public.${tableName}') IS NOT NULL AS exists;`
      });
      if (error) {
        console.error(`Error checking if table ${tableName} exists:`, error);
        return false;
      }
      return data && data[0] && (data[0].exists === true || data[0].exists === 't');
    }

    if (!client) {
      console.error('Failed to initialize Supabase client');
      return;
    }
    
    console.log('Supabase client initialized successfully!');
    
    // Create location_proofs table with PostGIS extension
    console.log('Creating PostGIS extension (if not exists)...');
    
    const { error: extensionError } = await client.rpc('create_pg_extension', {
      name: 'postgis'
    });
    
    if (extensionError) {
      console.error('Error creating PostGIS extension:', extensionError);
      // Try alternative method
      const { error: sqlExtensionError } = await client.rpc('execute_sql', {
        sql: 'CREATE EXTENSION IF NOT EXISTS postgis;'
      });
      
      if (sqlExtensionError) {
        console.error('Error creating PostGIS extension with SQL:', sqlExtensionError);
        console.log('Will proceed anyway, as extension might already exist');
      } else {
        console.log('Successfully created PostGIS extension with SQL');
      }
    } else {
      console.log('Successfully created PostGIS extension');
    }

    // Check and create location_proofs table
    if (await tableExists('location_proofs')) {
      console.log('Table location_proofs already exists, skipping creation.');
    } else {
      console.log('Creating location_proofs table...');
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.location_proofs (
          uid VARCHAR PRIMARY KEY,
          chain VARCHAR NOT NULL,
          prover VARCHAR NOT NULL,
          subject VARCHAR,
          timestamp TIMESTAMPTZ,
          event_timestamp TIMESTAMPTZ NOT NULL,
          srs VARCHAR,
          location_type VARCHAR NOT NULL,
          location TEXT NOT NULL,
          longitude NUMERIC,
          latitude NUMERIC,
          recipe_types JSONB,
          recipe_payloads JSONB,
          media_types JSONB,
          media_data JSONB,
          memo TEXT,
          revoked BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      const { error: createTableError } = await client.rpc('execute_sql', { sql: createTableSQL });
      if (createTableError) {
        console.error('Error creating location_proofs table:', createTableError);
        return;
      }
      console.log('Successfully created location_proofs table');
    }
    
    // Add PostGIS geometry column
    console.log('Adding geometry column...');
    
    const addGeometrySQL = `
      SELECT AddGeometryColumn('public', 'location_proofs', 'geometry', 4326, 'GEOMETRY', 2);
    `;
    
    const { error: addGeometryError } = await client.rpc('execute_sql', {
      sql: addGeometrySQL
    });
    
    if (addGeometryError) {
      console.error('Error adding geometry column:', addGeometryError);
      console.log('Will check if column already exists...');
      
      // Check if geometry column already exists
      const { error: checkColumnError } = await client.rpc('execute_sql', {
        sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'location_proofs' AND column_name = 'geometry';"
      });
      
      if (checkColumnError) {
        console.error('Error checking geometry column:', checkColumnError);
      } else {
        console.log('Geometry column might already exist, continuing...');
      }
    } else {
      console.log('Successfully added geometry column');
    }
    
    // Create indexes
    console.log('Creating indexes...');
    
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_location_proofs_chain ON public.location_proofs(chain);
      CREATE INDEX IF NOT EXISTS idx_location_proofs_prover ON public.location_proofs(prover);
      CREATE INDEX IF NOT EXISTS idx_location_proofs_subject ON public.location_proofs(subject);
      CREATE INDEX IF NOT EXISTS idx_location_proofs_timestamp ON public.location_proofs(event_timestamp);
      CREATE INDEX IF NOT EXISTS idx_location_proofs_geometry ON public.location_proofs USING GIST(geometry);
    `;
    
    const { error: createIndexesError } = await client.rpc('execute_sql', {
      sql: createIndexesSQL
    });
    
    if (createIndexesError) {
      console.error('Error creating indexes:', createIndexesError);
    } else {
      console.log('Successfully created indexes');
    }
    
    // Create trigger for updated_at
    console.log('Creating update trigger...');
    
    const createTriggerSQL = `
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS set_timestamp ON public.location_proofs;
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON public.location_proofs
      FOR EACH ROW
      EXECUTE PROCEDURE update_timestamp();
    `;
    
    const { error: createTriggerError } = await client.rpc('execute_sql', {
      sql: createTriggerSQL
    });
    
    if (createTriggerError) {
      console.error('Error creating update trigger:', createTriggerError);
    } else {
      console.log('Successfully created update trigger');
    }
    
    // Check and create worker_stats table
    if (await tableExists('worker_stats')) {
      console.log('Table worker_stats already exists, skipping creation.');
    } else {
      console.log('Creating worker_stats table...');
      const createWorkerStatsSQL = `
        CREATE TABLE IF NOT EXISTS public.worker_stats (
          id INTEGER PRIMARY KEY,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          start_time TIMESTAMPTZ,
          last_successful_run TIMESTAMPTZ,
          last_run_duration DOUBLE PRECISION,
          total_runs INTEGER,
          successful_runs INTEGER,
          failed_runs INTEGER,
          total_attestations_ingested JSONB,
          last_run_attestations_ingested JSONB,
          errors JSONB,
          revocation_last_run TIMESTAMPTZ,
          revocation_checked_count INTEGER,
          revocation_revoked_count INTEGER,
          is_running BOOLEAN,
          is_revocation_check_running BOOLEAN
        );
      `;
      const { error: createWorkerStatsError } = await client.rpc('execute_sql', { sql: createWorkerStatsSQL });
      if (createWorkerStatsError) {
        console.error('Error creating worker_stats table:', createWorkerStatsError);
      } else {
        console.log('Successfully created worker_stats table');
      }
    }

    // Check and create sync_history table
    if (await tableExists('sync_history')) {
      console.log('Table sync_history already exists, skipping creation.');
    } else {
      console.log('Creating sync_history table...');
      const createSyncHistorySQL = `
        CREATE TABLE IF NOT EXISTS public.sync_history (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          stats JSONB
        );
      `;
      const { error: createSyncHistoryError } = await client.rpc('execute_sql', { sql: createSyncHistorySQL });
      if (createSyncHistoryError) {
        console.error('Error creating sync_history table:', createSyncHistoryError);
      } else {
        console.log('Successfully created sync_history table');
      }
    }

    // Create index on sync_history.created_at
    console.log('Creating index on sync_history.created_at...');
    const createSyncHistoryIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_sync_history_created_at ON public.sync_history(created_at);
    `;
    const { error: createSyncHistoryIndexError } = await client.rpc('execute_sql', {
      sql: createSyncHistoryIndexSQL
    });
    if (createSyncHistoryIndexError) {
      console.error('Error creating index on sync_history.created_at:', createSyncHistoryIndexError);
    } else {
      console.log('Successfully created index on sync_history.created_at');
    }

    console.log('Database setup complete!');
  } catch (error: any) {
    console.error('Unexpected error:', error.message);
  }
}

setupSupabaseDb();
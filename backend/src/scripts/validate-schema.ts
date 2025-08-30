// NOTE: This script contains hardcoded expected schemas for location_proofs, worker_stats, and sync_history.
// If you change the migration SQL files, you MUST update the expected columns and indexes here as well.
// The migration SQL files in backend/src/migrations/ are the authoritative source of truth.
// Consider automating this in the future to avoid drift.

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config({ path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env' });

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableIndex {
  indexname: string;
  indexdef: string;
}

interface SchemaDifference {
  type: 'missing_table' | 'missing_column' | 'column_type_mismatch' | 'missing_index' | 'extra_table' | 'extra_column' | 'extra_index';
  table?: string;
  column?: string;
  expected?: string;
  actual?: string;
  details?: string;
}

export class SchemaValidator {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }

  /**
   * Get current database schema for all relevant tables
   */
  async getCurrentSchema(): Promise<{
    tables: string[];
    columns: { [table: string]: TableColumn[] };
    indexes: { [table: string]: TableIndex[] };
  }> {
    const client = await this.pool.connect();
    const relevantTables = ['location_proofs', 'worker_stats', 'sync_history'];
    try {
      // Get tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
      `, [relevantTables]);
      const tables = tablesResult.rows.map(row => row.table_name);
      const columns: { [table: string]: TableColumn[] } = {};
      const indexes: { [table: string]: TableIndex[] } = {};
      // Get columns and indexes for each table
      for (const table of tables) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        columns[table] = columnsResult.rows;
        const indexesResult = await client.query(`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = $1
        `, [table]);
        indexes[table] = indexesResult.rows;
      }
      return { tables, columns, indexes };
    } finally {
      client.release();
    }
  }

  /**
   * Compare current schema with expected schema for all relevant tables
   */
  async validateSchema(): Promise<SchemaDifference[]> {
    const differences: SchemaDifference[] = [];
    const currentSchema = await this.getCurrentSchema();

    // --- location_proofs ---
    const expectedLocationProofsColumns = [
      { column_name: 'uid', data_type: 'character varying', is_nullable: 'NO' },
      { column_name: 'chain', data_type: 'character varying', is_nullable: 'NO' },
      { column_name: 'prover', data_type: 'character varying', is_nullable: 'NO' },
      { column_name: 'subject', data_type: 'character varying', is_nullable: 'YES' },
      { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'event_timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'srs', data_type: 'character varying', is_nullable: 'YES' },
      { column_name: 'location_type', data_type: 'character varying', is_nullable: 'NO' },
      { column_name: 'location', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'longitude', data_type: 'numeric', is_nullable: 'YES' },
      { column_name: 'latitude', data_type: 'numeric', is_nullable: 'YES' },
      { column_name: 'geometry', data_type: 'USER-DEFINED', is_nullable: 'YES' },
      { column_name: 'recipe_types', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'recipe_payloads', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'media_types', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'media_data', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'memo', data_type: 'text', is_nullable: 'YES' },
      { column_name: 'revoked', data_type: 'boolean', is_nullable: 'YES' },
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES' },
    ];
    const expectedLocationProofsIndexes = [
      'idx_location_proofs_chain',
      'idx_location_proofs_prover', 
      'idx_location_proofs_event_timestamp',
      'idx_location_proofs_geometry',
    ];
    this.compareTableSchema('location_proofs', expectedLocationProofsColumns, expectedLocationProofsIndexes, currentSchema, differences);

    // --- worker_stats ---
    const expectedWorkerStatsColumns = [
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'start_time', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'last_successful_run', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'last_run_duration', data_type: 'double precision', is_nullable: 'YES' },
      { column_name: 'total_runs', data_type: 'integer', is_nullable: 'YES' },
      { column_name: 'successful_runs', data_type: 'integer', is_nullable: 'YES' },
      { column_name: 'failed_runs', data_type: 'integer', is_nullable: 'YES' },
      { column_name: 'total_attestations_ingested', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'last_run_attestations_ingested', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'errors', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'revocation_last_run', data_type: 'timestamp with time zone', is_nullable: 'YES' },
      { column_name: 'revocation_checked_count', data_type: 'integer', is_nullable: 'YES' },
      { column_name: 'revocation_revoked_count', data_type: 'integer', is_nullable: 'YES' },
      { column_name: 'is_running', data_type: 'boolean', is_nullable: 'YES' },
      { column_name: 'is_revocation_check_running', data_type: 'boolean', is_nullable: 'YES' },
    ];
    // No indexes expected for worker_stats
    this.compareTableSchema('worker_stats', expectedWorkerStatsColumns, [], currentSchema, differences);

    // --- sync_history ---
    const expectedSyncHistoryColumns = [
      { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
      { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
      { column_name: 'stats', data_type: 'jsonb', is_nullable: 'NO' },
    ];
    const expectedSyncHistoryIndexes = [
      'idx_sync_history_created_at',
    ];
    this.compareTableSchema('sync_history', expectedSyncHistoryColumns, expectedSyncHistoryIndexes, currentSchema, differences);

    return differences;
  }

  /**
   * Compare a table's columns and indexes with expected schema
   */
  private compareTableSchema(
    table: string,
    expectedColumns: { column_name: string; data_type: string; is_nullable: string }[],
    expectedIndexes: string[],
    currentSchema: { tables: string[]; columns: { [table: string]: TableColumn[] }; indexes: { [table: string]: TableIndex[] } },
    differences: SchemaDifference[]
  ) {
    if (!currentSchema.tables.includes(table)) {
      differences.push({
        type: 'missing_table',
        table,
        details: `Table ${table} does not exist`
      });
      return;
    }
    const currentColumns = currentSchema.columns[table] || [];
    const currentIndexes = currentSchema.indexes[table] || [];
    // Check columns
    for (const expectedCol of expectedColumns) {
      const currentCol = currentColumns.find(col => col.column_name === expectedCol.column_name);
      if (!currentCol) {
        differences.push({
          type: 'missing_column',
          table,
          column: expectedCol.column_name,
          expected: expectedCol.data_type,
          details: `Column ${expectedCol.column_name} is missing`
        });
      } else if (currentCol.data_type !== expectedCol.data_type) {
        differences.push({
          type: 'column_type_mismatch',
          table,
          column: expectedCol.column_name,
          expected: expectedCol.data_type,
          actual: currentCol.data_type,
          details: `Column ${expectedCol.column_name} type mismatch`
        });
      }
    }
    // Check for extra columns
    for (const currentCol of currentColumns) {
      const expectedCol = expectedColumns.find(col => col.column_name === currentCol.column_name);
      if (!expectedCol) {
        differences.push({
          type: 'extra_column',
          table,
          column: currentCol.column_name,
          actual: currentCol.data_type,
          details: `Extra column ${currentCol.column_name} found`
        });
      }
    }
    // Check indexes
    for (const expectedIndex of expectedIndexes) {
      const currentIndex = currentIndexes.find(idx => idx.indexname === expectedIndex);
      if (!currentIndex) {
        differences.push({
          type: 'missing_index',
          table,
          expected: expectedIndex,
          details: `Index ${expectedIndex} is missing`
        });
      }
    }
  }

  /**
   * Print schema differences in a table format
   */
  printDifferences(differences: SchemaDifference[]): void {
    if (differences.length === 0) {
      console.log('✅ Database schema is up to date!');
      return;
    }

    console.log('\n❌ Schema differences found:');
    console.log('┌─────────────────────┬──────────────────┬──────────────────┬─────────────────────┬──────────────────────────────────────┐');
    console.log('│ Type                │ Table            │ Column/Index     │ Expected            │ Actual                               │');
    console.log('├─────────────────────┼──────────────────┼──────────────────┼─────────────────────┼──────────────────────────────────────┤');
    
    for (const diff of differences) {
      const type = diff.type.padEnd(19);
      const table = (diff.table || '').padEnd(16);
      const column = (diff.column || diff.expected || '').padEnd(16);
      const expected = (diff.expected || '').padEnd(19);
      const actual = (diff.actual || '').padEnd(36);
      
      console.log(`│ ${type} │ ${table} │ ${column} │ ${expected} │ ${actual} │`);
    }
    
    console.log('└─────────────────────┴──────────────────┴──────────────────┴─────────────────────┴──────────────────────────────────────┘');
    console.log(`\nTotal differences: ${differences.length}`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// CLI usage
if (require.main === module) {
  async function run() {
    const validator = new SchemaValidator();
    
    try {
      console.log('🔍 Validating database schema...');
      const differences = await validator.validateSchema();
      validator.printDifferences(differences);
      
      if (differences.length > 0) {
        console.log('\n💡 To fix these issues, run: npm run db:setup');
        process.exit(1);
      }
    } catch (error) {
      console.error('Error validating schema:', error);
      process.exit(1);
    } finally {
      await validator.close();
    }
  }
  
  run();
}

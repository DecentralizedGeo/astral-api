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
   * Get current database schema for location_proofs table
   */
  async getCurrentSchema(): Promise<{
    tables: string[];
    columns: { [table: string]: TableColumn[] };
    indexes: { [table: string]: TableIndex[] };
  }> {
    const client = await this.pool.connect();
    
    try {
      // Get tables
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = 'location_proofs'
      `);
      
      const tables = tablesResult.rows.map(row => row.table_name);
      const columns: { [table: string]: TableColumn[] } = {};
      const indexes: { [table: string]: TableIndex[] } = {};

      // Get columns for each table
      for (const table of tables) {
        const columnsResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        columns[table] = columnsResult.rows;

        // Get indexes for each table
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
   * Compare current schema with expected schema
   */
  async validateSchema(): Promise<SchemaDifference[]> {
    const differences: SchemaDifference[] = [];
    const currentSchema = await this.getCurrentSchema();
    
    // Expected schema for location_proofs table
    const expectedColumns = [
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

    const expectedIndexes = [
      'idx_location_proofs_chain',
      'idx_location_proofs_prover', 
      'idx_location_proofs_event_timestamp',
      'idx_location_proofs_geometry',
    ];

    // Check if location_proofs table exists
    if (!currentSchema.tables.includes('location_proofs')) {
      differences.push({
        type: 'missing_table',
        table: 'location_proofs',
        details: 'Table location_proofs does not exist'
      });
      return differences;
    }

    const currentColumns = currentSchema.columns['location_proofs'] || [];
    const currentIndexes = currentSchema.indexes['location_proofs'] || [];

    // Check columns
    for (const expectedCol of expectedColumns) {
      const currentCol = currentColumns.find(col => col.column_name === expectedCol.column_name);
      
      if (!currentCol) {
        differences.push({
          type: 'missing_column',
          table: 'location_proofs',
          column: expectedCol.column_name,
          expected: expectedCol.data_type,
          details: `Column ${expectedCol.column_name} is missing`
        });
      } else if (currentCol.data_type !== expectedCol.data_type) {
        differences.push({
          type: 'column_type_mismatch',
          table: 'location_proofs',
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
          table: 'location_proofs',
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
          table: 'location_proofs',
          expected: expectedIndex,
          details: `Index ${expectedIndex} is missing`
        });
      }
    }

    return differences;
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

import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { LocationProof, LocationProofQueryParams } from '../models/types';

/**
 * Database service for managing location proof data
 */
class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
    });

    // Test connection on initialization
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Insert a new location proof into the database
   */
  async insertLocationProof(proof: Omit<LocationProof, 'created_at' | 'updated_at'>): Promise<LocationProof> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Create the geometry from longitude and latitude if available
      let geometrySql = 'NULL';
      if (proof.longitude !== undefined && proof.latitude !== undefined) {
        geometrySql = `ST_SetSRID(ST_MakePoint($1, $2), 4326)`;
      }
      
      const query = `
        INSERT INTO location_proofs (
          uid, chain, prover, subject, timestamp, event_timestamp, 
          srs, location_type, location, longitude, latitude, geometry,
          recipe_types, recipe_payloads, media_types, media_data, memo, revoked
        ) VALUES (
          $3, $4, $5, $6, $7, $8, 
          $9, $10, $11, $1, $2, ${geometrySql},
          $12, $13, $14, $15, $16, $17
        )
        RETURNING *;
      `;
      
      const values = [
        proof.longitude, 
        proof.latitude,
        proof.uid,
        proof.chain,
        proof.prover,
        proof.subject || null,
        proof.timestamp || null,
        proof.event_timestamp,
        proof.srs || null,
        proof.location_type,
        proof.location,
        proof.recipe_types ? JSON.stringify(proof.recipe_types) : null,
        proof.recipe_payloads ? JSON.stringify(proof.recipe_payloads) : null,
        proof.media_types ? JSON.stringify(proof.media_types) : null,
        proof.media_data ? JSON.stringify(proof.media_data) : null,
        proof.memo || null,
        proof.revoked || false
      ];
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows[0] as LocationProof;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error inserting location proof:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a location proof by its UID
   */
  async getLocationProofByUid(uid: string): Promise<LocationProof | null> {
    const query = 'SELECT * FROM location_proofs WHERE uid = $1';
    const result = await this.pool.query(query, [uid]);
    
    return result.rows[0] as LocationProof || null;
  }

  /**
   * Query location proofs with optional filters
   */
  async queryLocationProofs(params: LocationProofQueryParams = {}): Promise<LocationProof[]> {
    let query = 'SELECT * FROM location_proofs WHERE true';
    const values: any[] = [];
    let valueIndex = 1;
    
    // Apply filters
    if (params.chain) {
      query += ` AND chain = $${valueIndex++}`;
      values.push(params.chain);
    }
    
    if (params.prover) {
      query += ` AND prover = $${valueIndex++}`;
      values.push(params.prover);
    }
    
    if (params.subject) {
      query += ` AND subject = $${valueIndex++}`;
      values.push(params.subject);
    }
    
    if (params.fromTimestamp) {
      query += ` AND event_timestamp >= $${valueIndex++}`;
      values.push(params.fromTimestamp);
    }
    
    if (params.toTimestamp) {
      query += ` AND event_timestamp <= $${valueIndex++}`;
      values.push(params.toTimestamp);
    }
    
    if (params.bbox) {
      query += ` AND geometry && ST_MakeEnvelope($${valueIndex++}, $${valueIndex++}, $${valueIndex++}, $${valueIndex++}, 4326)`;
      values.push(params.bbox[0], params.bbox[1], params.bbox[2], params.bbox[3]);
    }
    
    // Order by event timestamp (newest first)
    query += ' ORDER BY event_timestamp DESC';
    
    // Apply pagination
    if (params.limit) {
      query += ` LIMIT $${valueIndex++}`;
      values.push(params.limit);
    }
    
    if (params.offset) {
      query += ` OFFSET $${valueIndex++}`;
      values.push(params.offset);
    }
    
    const result = await this.pool.query(query, values);
    return result.rows as LocationProof[];
  }

  /**
   * Mark a location proof as revoked
   */
  async revokeLocationProof(uid: string): Promise<boolean> {
    const query = 'UPDATE location_proofs SET revoked = true WHERE uid = $1 RETURNING *';
    const result = await this.pool.query(query, [uid]);
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Check if a location proof exists by UID
   */
  async locationProofExists(uid: string): Promise<boolean> {
    const query = 'SELECT 1 FROM location_proofs WHERE uid = $1';
    const result = await this.pool.query(query, [uid]);
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Export a singleton instance
export const dbService = new DatabaseService();
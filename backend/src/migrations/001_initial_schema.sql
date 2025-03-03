-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the location_proofs table
CREATE TABLE IF NOT EXISTS location_proofs (
  uid VARCHAR PRIMARY KEY,              -- Attestation UID
  chain VARCHAR NOT NULL,               -- Network identifier (e.g., arbitrum, celo)
  prover VARCHAR NOT NULL,              -- Address of the prover (attester)
  subject VARCHAR,                      -- Subject address or ID (if applicable)
  timestamp TIMESTAMPTZ,                -- Block timestamp or attestation time
  event_timestamp TIMESTAMPTZ NOT NULL, -- The claimed event time
  srs VARCHAR,                          -- Spatial reference system (e.g., "EPSG:4326")
  location_type VARCHAR NOT NULL,       -- Type of location data (e.g., "DecimalDegrees")
  location TEXT NOT NULL,               -- Raw location string (e.g., "[lon, lat]")
  longitude NUMERIC,                    -- Parsed longitude (for convenience)
  latitude NUMERIC,                     -- Parsed latitude (for convenience)
  geometry GEOMETRY(Geometry, 4326),    -- Spatial data in PostGIS format
  recipe_types JSONB,                   -- Array of proof recipe identifiers
  recipe_payloads JSONB,                -- Array of recipe payload blobs
  media_types JSONB,                    -- Array of media types
  media_data JSONB,                     -- Array of media data (e.g., IPFS CIDs)
  memo TEXT,                            -- Text note
  revoked BOOLEAN DEFAULT false,        -- Whether attestation is revoked
  created_at TIMESTAMPTZ DEFAULT NOW(), -- Record creation time
  updated_at TIMESTAMPTZ DEFAULT NOW()  -- Record update time
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_location_proofs_chain ON location_proofs(chain);
CREATE INDEX IF NOT EXISTS idx_location_proofs_prover ON location_proofs(prover);
CREATE INDEX IF NOT EXISTS idx_location_proofs_event_timestamp ON location_proofs(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_location_proofs_geometry ON location_proofs USING GIST(geometry);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER location_proofs_update_timestamp
BEFORE UPDATE ON location_proofs
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Create a publication for Supabase Realtime
DROP PUBLICATION IF EXISTS location_proofs_publication;
CREATE PUBLICATION location_proofs_publication FOR TABLE location_proofs;
-- Enable PostGIS extension if not already enabled
create extension IF not exists postgis;

-- Create the location_proofs table
create table if not exists location_proofs (
  uid VARCHAR primary key, -- Attestation UID
  chain VARCHAR not null, -- Network identifier (e.g., arbitrum, celo)
  prover VARCHAR not null, -- Address of the prover (attester)
  subject VARCHAR, -- Subject address or ID (if applicable)
  timestamp TIMESTAMPTZ, -- Block timestamp or attestation time
  event_timestamp TIMESTAMPTZ not null, -- The claimed event time
  srs VARCHAR, -- Spatial reference system (e.g., "EPSG:4326")
  location_type VARCHAR not null, -- Type of location data (e.g., "DecimalDegrees")
  location TEXT not null, -- Raw location string (e.g., "[lon, lat]")
  longitude NUMERIC, -- Parsed longitude (for convenience)
  latitude NUMERIC, -- Parsed latitude (for convenience)
  geometry GEOMETRY (Geometry, 4326), -- Spatial data in PostGIS format
  recipe_types JSONB, -- Array of proof recipe identifiers
  recipe_payloads JSONB, -- Array of recipe payload blobs
  media_types JSONB, -- Array of media types
  media_data JSONB, -- Array of media data (e.g., IPFS CIDs)
  memo TEXT, -- Text note
  revoked BOOLEAN default false, -- Whether attestation is revoked
  created_at TIMESTAMPTZ default NOW(), -- Record creation time
  updated_at TIMESTAMPTZ default NOW() -- Record update time
);

-- Create indexes for common queries
create index IF not exists idx_location_proofs_chain on location_proofs (chain);

create index IF not exists idx_location_proofs_prover on location_proofs (prover);

create index IF not exists idx_location_proofs_event_timestamp on location_proofs (event_timestamp);

create index IF not exists idx_location_proofs_geometry on location_proofs using GIST (geometry);

-- Create trigger to update updated_at timestamp
create or replace function update_timestamp () RETURNS TRIGGER as $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

drop trigger IF exists location_proofs_update_timestamp on location_proofs;

create trigger location_proofs_update_timestamp BEFORE
update on location_proofs for EACH row
execute FUNCTION update_timestamp ();

-- Create a publication for Supabase Realtime
drop publication IF exists location_proofs_publication;

create publication location_proofs_publication for table location_proofs;

-- Enable Row Level Security (RLS) and add policies
alter table location_proofs ENABLE row LEVEL SECURITY;

do $$
BEGIN
    CREATE POLICY "Allow anonymous read access"
      ON location_proofs
      FOR SELECT
      USING (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- policy already exists, ignore
END $$;

do $$
BEGIN
    CREATE POLICY "Allow service role full access"
      ON location_proofs
      FOR ALL
      USING (auth.role() = 'service_role');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Spatial query functions
-- Function to find location proofs within a certain distance of a point
create or replace function location_proofs_within (lng NUMERIC, lat NUMERIC, distance_meters NUMERIC) RETURNS SETOF location_proofs as $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM location_proofs
  WHERE ST_DWithin(
    geometry,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
    distance_meters
  );
END;
$$ LANGUAGE plpgsql;

-- Function to find location proofs within a bounding box
create or replace function location_proofs_in_bbox (
  min_lng NUMERIC,
  min_lat NUMERIC,
  max_lng NUMERIC,
  max_lat NUMERIC
) RETURNS SETOF location_proofs as $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM location_proofs
  WHERE geometry && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$ LANGUAGE plpgsql;
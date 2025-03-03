-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create function for bounding box queries
CREATE OR REPLACE FUNCTION query_locations_in_bbox(
  min_lon NUMERIC, 
  min_lat NUMERIC, 
  max_lon NUMERIC, 
  max_lat NUMERIC
) 
RETURNS SETOF location_proofs 
LANGUAGE SQL
AS \$\$
  SELECT * 
  FROM location_proofs 
  WHERE geometry && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326);
\$\$;

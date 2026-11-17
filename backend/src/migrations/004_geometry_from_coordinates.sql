-- Derive location_proofs.geometry from longitude/latitude in the database.
--
-- Why: only the direct pg insert path (DbService) built geometry. Rows written
-- through the Supabase client fallback (SupabaseService.createLocationProof)
-- had longitude/latitude but NULL geometry, so bbox, distance and OGC spatial
-- queries never returned them. Doing this in a trigger covers every write path.
--
-- Rules:
-- * INSERT: if geometry is NULL, set it to POINT(longitude latitude) in EPSG:4326.
-- * UPDATE: if longitude/latitude change and geometry was not changed in the
--   same statement, recompute it (NULL if the new coordinates are unusable).
--   If geometry is NULL after the update, fill it from the coordinates.
-- * Coordinates outside [-180, 180] / [-90, 90] are treated as unusable and
--   leave geometry NULL instead of failing the write.
-- * An explicitly supplied geometry (e.g. a polygon) is never overwritten.

create or replace function location_proof_point (lng NUMERIC, lat NUMERIC) RETURNS GEOMETRY
language sql IMMUTABLE as $$
  SELECT CASE
    WHEN lng IS NULL OR lat IS NULL THEN NULL
    WHEN lng NOT BETWEEN -180 AND 180 OR lat NOT BETWEEN -90 AND 90 THEN NULL
    ELSE ST_SetSRID(ST_MakePoint(lng::double precision, lat::double precision), 4326)
  END;
$$;

create or replace function set_location_proof_geometry () RETURNS TRIGGER
language plpgsql as $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.longitude IS DISTINCT FROM OLD.longitude OR NEW.latitude IS DISTINCT FROM OLD.latitude)
     AND NEW.geometry IS NOT DISTINCT FROM OLD.geometry THEN
    NEW.geometry := location_proof_point(NEW.longitude, NEW.latitude);
  ELSIF NEW.geometry IS NULL THEN
    NEW.geometry := location_proof_point(NEW.longitude, NEW.latitude);
  END IF;
  RETURN NEW;
END;
$$;

drop trigger IF exists location_proofs_set_geometry on location_proofs;

create trigger location_proofs_set_geometry BEFORE INSERT
or
update on location_proofs for EACH row
execute FUNCTION set_location_proof_geometry ();

-- Backfill rows written without geometry and report how many were fixed.
do $$
DECLARE
  missing_before BIGINT;
  backfilled BIGINT;
BEGIN
  SELECT count(*) INTO missing_before FROM location_proofs WHERE geometry IS NULL;

  UPDATE location_proofs
  SET geometry = location_proof_point(longitude, latitude)
  WHERE geometry IS NULL
    AND location_proof_point(longitude, latitude) IS NOT NULL;
  GET DIAGNOSTICS backfilled = ROW_COUNT;

  RAISE NOTICE 'location_proofs geometry backfill: % rows had NULL geometry, % backfilled, % still NULL (no usable coordinates)',
    missing_before, backfilled, missing_before - backfilled;
END $$;

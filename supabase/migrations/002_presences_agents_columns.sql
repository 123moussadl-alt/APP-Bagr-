-- Migration 002: Add columns to presences_agents for FICHE A and FICHE B
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS heure NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS jour NUMERIC DEFAULT 0;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS present BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS absent BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS heure_appel TEXT;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS mesures_prises TEXT;
ALTER TABLE IF EXISTS public.presences_agents ADD COLUMN IF NOT EXISTS references_pieces TEXT;

GRANT ALL PRIVILEGES ON TABLE public.presences_agents TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

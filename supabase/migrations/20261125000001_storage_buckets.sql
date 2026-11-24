-- 1. Create Public Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('tournament-assets', 'tournament-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    ('organization-assets', 'organization-assets', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    ('player-avatars', 'player-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage RLS Policies
-- Public Read Access
CREATE POLICY "Public Read All Assets"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('tournament-assets', 'organization-assets', 'player-avatars'));

-- Authenticated Users Can Upload
CREATE POLICY "Authenticated Users Upload Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('tournament-assets', 'organization-assets', 'player-avatars'));

-- Authenticated Users Can Update / Upsert Their Assets
CREATE POLICY "Authenticated Users Update Assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('tournament-assets', 'organization-assets', 'player-avatars'));

-- Extend preset_points table schema
ALTER TABLE oi.preset_points 
ADD COLUMN IF NOT EXISTS floorplan_image_url TEXT,
ADD COLUMN IF NOT EXISTS apt_id INTEGER;

-- Add foreign key constraint for data integrity
ALTER TABLE oi.preset_points 
ADD CONSTRAINT IF NOT EXISTS fk_preset_points_apt_id 
FOREIGN KEY (apt_id) REFERENCES oi.apt_info(id);

-- Check the updated table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'oi' AND table_name = 'preset_points'
ORDER BY ordinal_position;
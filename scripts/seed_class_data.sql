-- Seed class centers and batches for Robotics programme
-- Idempotent: uses ON CONFLICT DO NOTHING

INSERT INTO class_centers (id, name, mode, address, is_active) VALUES
  (gen_random_uuid(), 'Medavakkam',  'offline', 'Medavakkam, Chennai',  true),
  (gen_random_uuid(), 'Velachery',   'offline', 'Velachery, Chennai',   true),
  (gen_random_uuid(), 'KK Nagar',    'offline', 'KK Nagar, Chennai',    true),
  (gen_random_uuid(), 'Arumbakkam',  'offline', 'Arumbakkam, Chennai',  true),
  (gen_random_uuid(), 'Ambattur',    'offline', 'Ambattur, Chennai',    true),
  (gen_random_uuid(), 'Online',      'online',  NULL,                   true)
ON CONFLICT (name) DO NOTHING;

-- Medavakkam batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'Apr 28 – May 9',  '2026-04-28', '2026-05-09', '11:30 AM – 12:30 PM', 'offline', true FROM class_centers WHERE name = 'Medavakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', '10:00 AM – 11:00 AM', 'offline', true FROM class_centers WHERE name = 'Medavakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', '11:30 AM – 12:30 PM', 'offline', true FROM class_centers WHERE name = 'Medavakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', '10:00 AM – 12:00 PM', 'offline', true FROM class_centers WHERE name = 'Medavakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', '11:30 AM – 1:30 PM',  'offline', true FROM class_centers WHERE name = 'Medavakkam' ON CONFLICT (center_id, label) DO NOTHING;

-- Velachery batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'Apr 28 – May 9',  '2026-04-28', '2026-05-09', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'Velachery' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', '4:00 PM – 5:00 PM', 'offline', true FROM class_centers WHERE name = 'Velachery' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'Velachery' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', '4:00 PM – 5:00 PM', 'offline', true FROM class_centers WHERE name = 'Velachery' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', '5:30 PM – 7:30 PM', 'offline', true FROM class_centers WHERE name = 'Velachery' ON CONFLICT (center_id, label) DO NOTHING;

-- KK Nagar batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'Apr 28 – May 9',  '2026-04-28', '2026-05-09', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'KK Nagar' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'KK Nagar' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', '4:00 PM – 5:00 PM', 'offline', true FROM class_centers WHERE name = 'KK Nagar' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'KK Nagar' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', '4:00 PM – 6:00 PM', 'offline', true FROM class_centers WHERE name = 'KK Nagar' ON CONFLICT (center_id, label) DO NOTHING;

-- Arumbakkam batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'Apr 28 – May 9',  '2026-04-28', '2026-05-09', '11:30 AM – 12:30 PM', 'offline', true FROM class_centers WHERE name = 'Arumbakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', '10:00 AM – 11:00 AM', 'offline', true FROM class_centers WHERE name = 'Arumbakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', '11:30 AM – 12:30 PM', 'offline', true FROM class_centers WHERE name = 'Arumbakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', '10:00 AM – 11:00 AM', 'offline', true FROM class_centers WHERE name = 'Arumbakkam' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', '11:30 AM – 1:30 PM',  'offline', true FROM class_centers WHERE name = 'Arumbakkam' ON CONFLICT (center_id, label) DO NOTHING;

-- Ambattur batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', '4:00 PM – 5:00 PM', 'offline', true FROM class_centers WHERE name = 'Ambattur' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', '5:30 PM – 6:30 PM', 'offline', true FROM class_centers WHERE name = 'Ambattur' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', '4:00 PM – 5:00 PM', 'offline', true FROM class_centers WHERE name = 'Ambattur' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', '5:30 PM – 7:30 PM', 'offline', true FROM class_centers WHERE name = 'Ambattur' ON CONFLICT (center_id, label) DO NOTHING;

-- Online batches
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'Apr 28 – May 9',  '2026-04-28', '2026-05-09', 'Flexible', 'online', true FROM class_centers WHERE name = 'Online' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 5 – May 16',  '2026-05-05', '2026-05-16', 'Flexible', 'online', true FROM class_centers WHERE name = 'Online' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 12 – May 23', '2026-05-12', '2026-05-23', 'Flexible', 'online', true FROM class_centers WHERE name = 'Online' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 19 – May 30', '2026-05-19', '2026-05-30', 'Flexible', 'online', true FROM class_centers WHERE name = 'Online' ON CONFLICT (center_id, label) DO NOTHING;
INSERT INTO class_batches (id, center_id, label, start_date, end_date, time_slot, mode, is_active)
SELECT gen_random_uuid(), id, 'May 26 – May 30', '2026-05-26', '2026-05-30', 'Flexible', 'online', true FROM class_centers WHERE name = 'Online' ON CONFLICT (center_id, label) DO NOTHING;

SELECT 'Seed complete' AS status,
  (SELECT count(*) FROM class_centers) AS centers,
  (SELECT count(*) FROM class_batches) AS batches;

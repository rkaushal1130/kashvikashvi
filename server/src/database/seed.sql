-- =============================================================================
-- KASHVIMLM DATABASE SEED SCRIPT
-- Seeds complete verified Binary MLM Tree (Rahul KV-1001 through Suresh KV-1007+),
-- Business Centers (BC-001, BC-002, BC-003), Products, Wallets, and BV ledgers.
-- =============================================================================

-- 1. USERS
INSERT INTO users (id, email, phone, username, password_hash, role, is_active)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    'rahul.kaushal@kashvimlm.com',
    '+91 98765 43210',
    '@rahul_kaushal',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'admin',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000002',
    'amit.patel@kashvimlm.com',
    '+91 98765 43211',
    '@amit_patel',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000003',
    'rohit.verma@kashvimlm.com',
    '+91 98765 43212',
    '@rohit_verma',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000004',
    'priya.sharma@kashvimlm.com',
    '+91 98765 43213',
    '@priya_sharma',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000005',
    'pooja.gupta@kashvimlm.com',
    '+91 98765 43214',
    '@pooja_gupta',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    FALSE
),
(
    'a0000000-0000-0000-0000-000000000006',
    'neha.mehta@kashvimlm.com',
    '+91 98765 43215',
    '@neha_mehta',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000007',
    'suresh.rao@kashvimlm.com',
    '+91 98765 43216',
    '@suresh_rao',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    FALSE
),
(
    'a0000000-0000-0000-0000-000000000008',
    'harsh.kapoor@kashvimlm.com',
    '+91 98765 43217',
    '@harsh_kapoor',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000009',
    'isha.nair@kashvimlm.com',
    '+91 98765 43218',
    '@isha_nair',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000091',
    'admin@example.com',
    '+91 98765 00001',
    '@admin_example',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'admin',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000092',
    'distributor@example.com',
    '+91 98765 00002',
    '@distributor_example',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    TRUE
),
(
    'a0000000-0000-0000-0000-000000000093',
    'suspended@example.com',
    '+91 98765 00003',
    '@suspended_example',
    '$2a$10$w8TfVzPZZlV7k6YQhG/4OecEwJ9i7q.F1q7GkJ2bU8o5x4fK7v7qO',
    'distributor',
    FALSE
)
ON CONFLICT (email) DO UPDATE SET is_active = EXCLUDED.is_active;

-- 2. DISTRIBUTORS
INSERT INTO distributors (
    id, user_id, member_id, full_name, sponsor_id, parent_id,
    placement_leg, rank, qualification_status, current_psv, lifetime_bv,
    team_size, bank_name, bank_account_number, bank_ifsc_code, pan_number,
    address, city, state, pincode, country
) VALUES
(
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'KV-1001',
    'Rahul Kaushal',
    'KV-1000',
    NULL,
    'auto',
    'Business Center',
    'Active',
    250.00,
    25950.00,
    42,
    'HDFC Bank',
    '50100492819201',
    'HDFC0000123',
    'ABCDE1234F',
    'Greenfield Heights, Sector 18',
    'Mumbai',
    'Maharashtra',
    '400053',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'KV-1002',
    'Amit Patel',
    'KV-1001',
    'KV-1001',
    'left',
    'Executive Director',
    'Active',
    200.00,
    14400.00,
    18,
    'State Bank of India',
    '20100492819202',
    'SBIN0000456',
    'BCDEF2345G',
    'MG Road, Bandra West',
    'Mumbai',
    'Maharashtra',
    '400050',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'KV-1003',
    'Rohit Verma',
    'KV-1001',
    'KV-1001',
    'right',
    'Senior Director',
    'Active',
    150.00,
    11150.00,
    14,
    'ICICI Bank',
    '30100492819203',
    'ICIC0000789',
    'CDEFG3456H',
    'Koregaon Park',
    'Pune',
    'Maharashtra',
    '411001',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    'KV-1004',
    'Priya Sharma',
    'KV-1001',
    'KV-1002',
    'left',
    'Silver Director',
    'Active',
    150.00,
    6750.00,
    8,
    'Axis Bank',
    '40100492819204',
    'UTIB0000101',
    'DEFGH4567I',
    'Sector 62',
    'Noida',
    'Uttar Pradesh',
    '201301',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000005',
    'KV-1005',
    'Pooja Gupta',
    'KV-1002',
    'KV-1002',
    'right',
    'Bronze Director',
    'Suspended',
    100.00,
    4900.00,
    6,
    'Punjab National Bank',
    '50100492819205',
    'PUNB0000202',
    'EFGHI5678J',
    'Civil Lines',
    'Jaipur',
    'Rajasthan',
    '302006',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000006',
    'KV-1006',
    'Neha Mehta',
    'KV-1003',
    'KV-1003',
    'left',
    'Silver Director',
    'Active',
    120.00,
    5420.00,
    6,
    'Kotak Mahindra Bank',
    '60100492819206',
    'KKBK0000303',
    'FGHIJ6789K',
    'Navrangpura',
    'Ahmedabad',
    'Gujarat',
    '380009',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000007',
    'KV-1007',
    'Suresh Rao',
    'KV-1001',
    'KV-1003',
    'right',
    'Gold Partner',
    'Inactive',
    0.00,
    3300.00,
    4,
    'Bank of Baroda',
    '70100492819207',
    'BARB0000404',
    'GHIJK7890L',
    'Alkapuri',
    'Vadodara',
    'Gujarat',
    '390007',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000008',
    'KV-1008',
    'Harsh Kapoor',
    'KV-1001',
    'KV-1004',
    'left',
    'Senior Associate',
    'Active',
    100.00,
    2200.00,
    2,
    'HDFC Bank',
    '50100492819208',
    'HDFC0000123',
    'HIJKL8901M',
    'Kankarbagh',
    'Patna',
    'Bihar',
    '800020',
    'India'
),
(
    'b0000000-0000-0000-0000-000000000009',
    'a0000000-0000-0000-0000-000000000009',
    'KV-1009',
    'Isha Nair',
    'KV-1001',
    'KV-1004',
    'right',
    'Associate',
    'Active',
    100.00,
    1800.00,
    1,
    'ICICI Bank',
    '30100492819209',
    'ICIC0000789',
    'IJKLM9012N',
    'Panampilly Nagar',
    'Kochi',
    'Kerala',
    '682036',
    'India'
)
ON CONFLICT (member_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    rank = EXCLUDED.rank,
    qualification_status = EXCLUDED.qualification_status;

-- 3. WALLETS
INSERT INTO wallets (id, distributor_id, available_balance, pending_balance, lifetime_earnings, lifetime_withdrawals)
VALUES
('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 42500.00, 12400.00, 285000.00, 242500.00),
('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 18200.00, 5600.00, 125000.00, 106800.00),
('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 14500.00, 4200.00, 95000.00, 80500.00),
('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 9800.00, 2800.00, 62000.00, 52200.00),
('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000005', 3200.00, 0.00, 32000.00, 28800.00),
('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 7400.00, 1900.00, 48000.00, 40600.00),
('c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000007', 1200.00, 0.00, 18000.00, 16800.00),
('c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000008', 3500.00, 500.00, 15000.00, 11500.00),
('c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000009', 2100.00, 300.00, 9000.00, 6900.00)
ON CONFLICT (distributor_id) DO NOTHING;

-- 4. MLM TREE TOPOLOGY (Parent -> Left Child / Right Child)
-- Clean existing tree rows to prevent conflict
DELETE FROM mlm_tree WHERE distributor_id IN (
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000007',
    'b0000000-0000-0000-0000-000000000008',
    'b0000000-0000-0000-0000-000000000009'
);

-- Root: Rahul (KV-1001)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'BC-001',
    NULL,
    'b0000000-0000-0000-0000-000000000002', -- Amit
    'b0000000-0000-0000-0000-000000000003', -- Rohit
    'ROOT',
    0,
    '/KV-1001'
);

-- Left Child of Rahul: Amit (KV-1002)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'BC-001',
    'b0000000-0000-0000-0000-000000000001', -- Parent: Rahul
    'b0000000-0000-0000-0000-000000000004', -- Left: Priya
    'b0000000-0000-0000-0000-000000000005', -- Right: Pooja
    'left',
    1,
    '/KV-1001/KV-1002'
);

-- Right Child of Rahul: Rohit (KV-1003)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'BC-001',
    'b0000000-0000-0000-0000-000000000001', -- Parent: Rahul
    'b0000000-0000-0000-0000-000000000006', -- Left: Neha
    'b0000000-0000-0000-0000-000000000007', -- Right: Suresh
    'right',
    1,
    '/KV-1001/KV-1003'
);

-- Left Child of Amit: Priya (KV-1004)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000004',
    'BC-002',
    'b0000000-0000-0000-0000-000000000002', -- Parent: Amit
    'b0000000-0000-0000-0000-000000000008', -- Left: Harsh
    'b0000000-0000-0000-0000-000000000009', -- Right: Isha
    'left',
    2,
    '/KV-1001/KV-1002/KV-1004'
);

-- Right Child of Amit: Pooja (KV-1005)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000005',
    'BC-002',
    'b0000000-0000-0000-0000-000000000002', -- Parent: Amit
    NULL,
    NULL,
    'right',
    2,
    '/KV-1001/KV-1002/KV-1005'
);

-- Left Child of Rohit: Neha (KV-1006)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000006',
    'BC-003',
    'b0000000-0000-0000-0000-000000000003', -- Parent: Rohit
    NULL,
    NULL,
    'left',
    2,
    '/KV-1001/KV-1003/KV-1006'
);

-- Right Child of Rohit: Suresh (KV-1007)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000007',
    'b0000000-0000-0000-0000-000000000007',
    'BC-003',
    'b0000000-0000-0000-0000-000000000003', -- Parent: Rohit
    NULL,
    NULL,
    'right',
    2,
    '/KV-1001/KV-1003/KV-1007'
);

-- Left Child of Priya: Harsh (KV-1008)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000008',
    'b0000000-0000-0000-0000-000000000008',
    'BC-002',
    'b0000000-0000-0000-0000-000000000004', -- Parent: Priya
    NULL,
    NULL,
    'left',
    3,
    '/KV-1001/KV-1002/KV-1004/KV-1008'
);

-- Right Child of Priya: Isha (KV-1009)
INSERT INTO mlm_tree (id, distributor_id, business_center_code, parent_distributor_id, left_child_id, right_child_id, leg_position, depth, tree_path)
VALUES (
    'd0000000-0000-0000-0000-000000000009',
    'b0000000-0000-0000-0000-000000000009',
    'BC-002',
    'b0000000-0000-0000-0000-000000000004', -- Parent: Priya
    NULL,
    NULL,
    'right',
    3,
    '/KV-1001/KV-1002/KV-1004/KV-1009'
);

-- 5. PRODUCTS (Clothes & Hosiery + Electronics)
INSERT INTO products (sku, name, category, distributor_price, mrp, volume_bv, stock_quantity, status, size_spec, short_desc, benefits, usage_instructions)
VALUES
(
    'KASH-HOZ-001',
    'Men''s Combed Cotton Hosiery T-Shirt',
    'Clothes & Hosiery (Hozri)',
    499.00,
    799.00,
    8.00,
    450,
    'In Stock',
    'Size: M / L / XL / XXL',
    '100% Super-combed breathable cotton hosiery fabric with soft ribbed collar.',
    '["Breathable all-day moisture wicking comfort", "Bio-washed anti-shrink fabric finish", "Zero-friction reinforced comfort seams"]'::jsonb,
    'Machine wash cold with like colors.'
),
(
    'KASH-HOZ-002',
    'Hosiery Comfort Innerwear / Vest (Pack of 2)',
    'Clothes & Hosiery (Hozri)',
    349.00,
    599.00,
    6.00,
    600,
    'In Stock',
    'Pack of 2 / Stretch Fit',
    'Ultra-soft stretchable micro-modal hosiery innerwear with contoured contour.',
    '["Moisture wicking sweat barrier protection", "Contoured body-hugging flexible fit", "Tagless comfort label to prevent irritation"]'::jsonb,
    'Daily base innerwear for all seasons.'
),
(
    'KASH-HOZ-003',
    'Anti-Bacterial Bamboo Hosiery Socks (Pack of 3)',
    'Clothes & Hosiery (Hozri)',
    299.00,
    499.00,
    5.00,
    850,
    'In Stock',
    'Pack of 3 Pairs',
    'Naturally anti-microbial bamboo-cotton blended hosiery socks with reinforced heel and toe.',
    '["Natural anti-odor shield prevents sweat bacteria", "Dynamic arch support compression band", "Soft terry sole cushioning for walking comfort"]'::jsonb,
    'Suitable for business, formal, and athletic footwear.'
),
(
    'KASH-HOZ-004',
    'Winter Fleeced Hosiery Hoodie & Sweatshirt',
    'Clothes & Hosiery (Hozri)',
    1199.00,
    1899.00,
    16.00,
    300,
    'In Stock',
    'Unisex Fit / Full Sleeves',
    'Heavy-weight brushed cotton fleece hosiery hoodie with front kangaroo pocket.',
    '["Thermal heat retention brushed inner lining", "Double-layered hood with adjustable drawstrings", "Ribbed elastane cuffs and waist hem"]'::jsonb,
    'Winter casual, morning walks, and outdoor travel.'
),
(
    'KASH-ELE-001',
    'Smart Active Wireless Noise-Cancelling Headphones',
    'Electronics & Smart Devices',
    2499.00,
    3999.00,
    25.00,
    200,
    'In Stock',
    'Headphones + Type-C Cable + Travel Pouch',
    'High-fidelity active noise-cancelling Bluetooth 5.3 headphones with deep bass drivers.',
    '["Up to 40 hours total wireless playback battery", "Hybrid active noise cancellation (ANC)", "Dual MEMS microphones for crystal-clear calls"]'::jsonb,
    'Power on and pair via Bluetooth with phone, tablet, or PC.'
),
(
    'KASH-ELE-002',
    'Smart Multi-Cook Digital Home Appliance',
    'Electronics & Smart Devices',
    3499.00,
    5499.00,
    35.00,
    150,
    'In Stock',
    '3.5L Cooking Capacity / 1200W',
    'Energy-efficient digital kitchen appliance with one-touch presets for healthy cooking.',
    '["Intelligent rapid 360-degree heating technology", "Non-stick dishwasher-safe food grade inner pot", "Overheat safety automatic shutoff mechanism"]'::jsonb,
    'Connect to standard 220V AC wall socket.'
),
(
    'KASH-ELE-003',
    'Ultra-Slim Pro Productivity Laptop',
    'Electronics & Smart Devices',
    38999.00,
    52999.00,
    220.00,
    50,
    'In Stock',
    '15.6 Inch Full HD IPS Screen',
    'High-performance ultra-slim notebook engineered for MLM business tracking and daily tasks.',
    '["High-speed SSD storage with 16GB high-bandwidth RAM", "Long-life 10-hour battery for working on the move", "Fingerprint biometric sensor for secure instant login"]'::jsonb,
    'Charge with provided 65W fast charger.'
),
(
    'KASH-ELE-004',
    'Pro 5G Dual-SIM Smartphone & Mobile Device',
    'Electronics & Smart Devices',
    14999.00,
    19999.00,
    120.00,
    120,
    'In Stock',
    '6.7 Inch AMOLED / 128GB Storage',
    'High-speed 5G smartphone equipped with AI triple camera and 5000mAh battery.',
    '["Super AMOLED 120Hz smooth refresh rate display", "5000mAh heavy-duty battery with 33W turbo charge", "50MP AI triple camera for clear video and photos"]'::jsonb,
    'Insert nano SIM card and follow initial Android setup.'
) ON CONFLICT (sku) DO NOTHING;

-- 6. INITIAL NOTIFICATION
INSERT INTO notifications (distributor_id, title, message, type)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Welcome to KASHVIMLM Enterprise Portal',
    'Your Business Center 001 is active. Weekly commission cycle cutoff is Friday 11:59 PM.',
    'SYSTEM'
);

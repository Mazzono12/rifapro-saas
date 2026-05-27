-- supabase/migrations/00_initial_schema.sql
-- ==============================================================================
-- ENTERPRISE RAFFLE PLATFORM - SUPABASE SCHEMA
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PROFILES (Usuarios)
-- ==========================================
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. RAFFLES (Rifas / Prêmios)
-- ==========================================
CREATE TABLE raffles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price_per_ticket DECIMAL(10,2) NOT NULL,
    total_tickets INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'finished')),
    draw_date TIMESTAMP WITH TIME ZONE,
    media_url TEXT,
    media_type TEXT,
    -- Escalabilidade: guarda apenas a quantidade vendida, não cada bilhete gerado 1 por 1
    tickets_sold INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. INSTANT PRIZES (Cotas Premiadas)
-- ==========================================
CREATE TABLE instant_prizes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
    ticket_number INTEGER NOT NULL,
    prize_name TEXT NOT NULL,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'won', 'claimed')),
    winner_id UUID REFERENCES profiles(id),
    won_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(raffle_id, ticket_number)
);

-- ==========================================
-- 4. PURCHASES (Compras de Cotas)
-- ==========================================
CREATE TABLE purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id),
    raffle_id UUID REFERENCES raffles(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    total_tickets INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    -- Arrays dinâmicos evitam tabelas colossais para 10+ milhões de números
    assigned_numbers INTEGER[], 
    ref_code TEXT,
    payment_id TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. AFFILIATES (Afiliados e Comissões)
-- ==========================================
CREATE TABLE affiliates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) UNIQUE,
    code TEXT UNIQUE NOT NULL,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    balance DECIMAL(10,2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE affiliate_commissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    affiliate_id UUID REFERENCES affiliates(id),
    purchase_id UUID REFERENCES purchases(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'withdrawn')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 6. LOOTBOXES (Caixinhas Premiadas)
-- ==========================================
CREATE TABLE user_lootboxes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id),
    available_boxes INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(profile_id)
);

CREATE TABLE lootbox_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id),
    prize_name TEXT NOT NULL,
    prize_value DECIMAL(10,2) DEFAULT 0,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- RLS - ROW LEVEL SECURITY (Segurança de Dados)
-- ==========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lootboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lootbox_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE instant_prizes ENABLE ROW LEVEL SECURITY;

-- Policies Principais
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Raffles are viewable by everyone" ON raffles FOR SELECT USING (true);
CREATE POLICY "Only admins can insert/update raffles" ON raffles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can view own purchases" ON purchases FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view own lootboxes" ON user_lootboxes FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can view own affiliate record" ON affiliates FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Admins can manage affiliates" ON affiliates FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can view own lootbox history" ON lootbox_history FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Admins can manage instant prizes" ON instant_prizes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ==========================================
-- ALGORITMO SQL ALTA PERFORMANCE: ATRIBUIÇÃO DE NÚMEROS (Prevenindo gargalo de 10M)
-- ==========================================
CREATE OR REPLACE FUNCTION assign_random_raffle_tickets(
  p_purchase_id UUID, 
  p_raffle_id UUID, 
  p_qty INTEGER
)
RETURNS INTEGER[] AS $$
DECLARE
  v_total_tickets INTEGER;
  v_sold INTEGER;
  v_assigned INTEGER[] := '{}';
  v_rand INTEGER;
  v_available_pool INTEGER;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER;
BEGIN
  -- Bloqueia a rifa para escrita paralela (concorrência)
  SELECT total_tickets, tickets_sold INTO v_total_tickets, v_sold
  FROM raffles WHERE id = p_raffle_id FOR UPDATE;

  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'Invalid ticket quantity';
  END IF;

  IF v_sold + p_qty > v_total_tickets THEN
    RAISE EXCEPTION 'Not enough tickets available';
  END IF;

  v_available_pool := v_total_tickets - v_sold;
  v_max_attempts := GREATEST(p_qty * 50, 500);

  WHILE array_length(v_assigned, 1) IS DISTINCT FROM p_qty LOOP
    IF v_attempts > v_max_attempts THEN
      RAISE EXCEPTION 'Unable to allocate random tickets without collision';
    END IF;

    v_rand := floor(random() * v_total_tickets + 1)::INTEGER;
    v_attempts := v_attempts + 1;

    IF NOT v_rand = ANY(v_assigned)
      AND NOT EXISTS (
        SELECT 1
        FROM purchases
        WHERE raffle_id = p_raffle_id
          AND status = 'paid'
          AND assigned_numbers @> ARRAY[v_rand]
      )
    THEN
      v_assigned := array_append(v_assigned, v_rand);
    END IF;
  END LOOP;
  
  UPDATE purchases
  SET assigned_numbers = v_assigned,
      status = 'paid'
  WHERE id = p_purchase_id
    AND raffle_id = p_raffle_id;

  UPDATE instant_prizes
  SET status = 'won',
      winner_id = (SELECT profile_id FROM purchases WHERE id = p_purchase_id),
      won_at = NOW()
  WHERE raffle_id = p_raffle_id
    AND status = 'available'
    AND ticket_number = ANY(v_assigned);

  UPDATE raffles SET tickets_sold = tickets_sold + p_qty WHERE id = p_raffle_id;
  
  RETURN v_assigned;
END;
$$ LANGUAGE plpgsql;

ALTER PUBLICATION supabase_realtime ADD TABLE raffles;
ALTER PUBLICATION supabase_realtime ADD TABLE purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE instant_prizes;

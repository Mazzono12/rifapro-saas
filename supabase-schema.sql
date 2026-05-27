-- ==============================================================================
-- NEXUS DRAW - BLUEPRINT DATABASE SCHEMA
-- PERFORMANCE OTMIZADA PARA ALTA ESCALA (Até 10 Milhões de Cotas por Sorteio)
-- ==============================================================================

-- 1. HABILITAR EXTENSÕES E FUNÇÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum Types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE raffle_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'purchase', 'commission', 'prize');

-- ==============================================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ==============================================================================

-- TABELA: usuários (Estende auth.users do Supabase)
CREATE TABLE public.usuarios (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    telefone VARCHAR(20) UNIQUE,
    role user_role DEFAULT 'user',
    avatar_url TEXT,
    saldo DECIMAL(12, 2) DEFAULT 0.00,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: configuracoes (Configurações Globais do Sistema)
CREATE TABLE public.configuracoes (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor JSONB NOT NULL,
    descricao TEXT,
    atualizado_por UUID REFERENCES public.usuarios(id),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: premios (Rifas principais)
CREATE TABLE public.premios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco_cota DECIMAL(10, 2) NOT NULL,
    total_cotas INTEGER NOT NULL CHECK (total_cotas > 0),
    cotas_vendidas INTEGER DEFAULT 0,
    limite_compra_por_usuario INTEGER DEFAULT 0, -- 0 = ilimitado
    imagem_url TEXT,
    status raffle_status DEFAULT 'draft',
    data_sorteio TIMESTAMPTZ,
    criado_por UUID REFERENCES public.usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: compras (Pedidos)
-- NOTA DE ESCALA: Usaremos INTEGER[] (array) para 'numeros' 
-- para suportar hiper-escala sem explodir o número de linhas no banco
CREATE TABLE public.compras (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    codigo_pedido VARCHAR(20) UNIQUE NOT NULL,
    premio_id UUID REFERENCES public.premios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    telefone_contato VARCHAR(20),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    numeros INTEGER[] DEFAULT '{}', 
    valor_total DECIMAL(12,2) NOT NULL,
    status payment_status DEFAULT 'pending',
    txid_pagamento VARCHAR(255),
    qrcode_pix TEXT,
    payload_pix TEXT,
    pago_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: afiliados (Sistema de Indicação)
CREATE TABLE public.afiliados (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) UNIQUE NOT NULL,
    codigo_indicacao VARCHAR(20) UNIQUE NOT NULL,
    url_personalizada VARCHAR(255) UNIQUE,
    taxa_comissao DECIMAL(5,2) DEFAULT 5.00, -- 5.00%
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: comissoes
CREATE TABLE public.comissoes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    afiliado_id UUID REFERENCES public.afiliados(id) NOT NULL,
    compra_id UUID REFERENCES public.compras(id) NOT NULL,
    valor_comissao DECIMAL(10,2) NOT NULL,
    status payment_status DEFAULT 'pending',
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: caixinhas (Carteira Digital / Transações)
CREATE TABLE public.caixinhas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) NOT NULL,
    tipo transaction_type NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    saldo_apos_transacao DECIMAL(12,2) NOT NULL,
    referencia_id UUID, -- Pode ligar a premio_id, compra_id, etc.
    descricao VARCHAR(255),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: stories (Marketing/Engajamento na Home)
CREATE TABLE public.stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    titulo VARCHAR(100),
    midia_url TEXT NOT NULL,
    tipo_midia VARCHAR(20) DEFAULT 'image', -- image ou video
    link_externo TEXT,
    ativo BOOLEAN DEFAULT true,
    expira_em TIMESTAMPTZ,
    criado_por UUID REFERENCES public.usuarios(id),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: ganhadores
CREATE TABLE public.ganhadores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    premio_id UUID REFERENCES public.premios(id) UNIQUE NOT NULL,
    usuario_id UUID REFERENCES public.usuarios(id),
    numero_sorteado INTEGER NOT NULL,
    compra_id UUID REFERENCES public.compras(id),
    depoimento TEXT,
    video_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- TABELA: premios_instantaneos (Bilhetes Premiados / Achou Ganhou)
CREATE TABLE public.premios_instantaneos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    premio_id UUID REFERENCES public.premios(id) ON DELETE CASCADE,
    numero_premiado INTEGER NOT NULL,
    valor_premio DECIMAL(10,2) NOT NULL,
    ganhador_id UUID REFERENCES public.usuarios(id),
    compra_id UUID REFERENCES public.compras(id),
    resgatado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(premio_id, numero_premiado)
);

-- TABELA: historico_premios (Log de auditoria para os sorteios)
CREATE TABLE public.historico_premios (
    id SERIAL PRIMARY KEY,
    premio_id UUID REFERENCES public.premios(id),
    acao VARCHAR(100) NOT NULL,
    payload JSONB,
    realizado_por UUID REFERENCES public.usuarios(id),
    realizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. ÍNDICES DE ALTA PERFORMANCE (B-TREE & GIN)
-- ==============================================================================

-- COMPRAS: Performance para buscar pedidos de um usuário rapidamente
CREATE INDEX idx_compras_usuario_status ON public.compras (usuario_id, status);
CREATE INDEX idx_compras_premio ON public.compras (premio_id);
CREATE INDEX idx_compras_txid ON public.compras (txid_pagamento);
-- COMPRAS: Necessário GIN array index se quisermos buscar quem comprou o número X
-- Isso é fundamental para rifas até 10M
CREATE INDEX idx_compras_numeros_gin ON public.compras USING GIN (numeros);

-- PREMIOS
CREATE INDEX idx_premios_status_data ON public.premios (status, data_sorteio);

-- AFILIADOS & COMISSOES
CREATE INDEX idx_afiliados_codigo ON public.afiliados (codigo_indicacao);
CREATE INDEX idx_comissoes_afiliado ON public.comissoes (afiliado_id, status);

-- CAIXINHAS
CREATE INDEX idx_caixinhas_usuario_data ON public.caixinhas (usuario_id, criado_em DESC);

-- ==============================================================================
-- 4. FUNÇÕES SQL (STORED PROCEDURES) & TRIGGERS
-- ==============================================================================

-- Atualiza 'atualizado_em' automaticamente em inserts/updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_usuarios BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_premios BEFORE UPDATE ON public.premios FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_compras BEFORE UPDATE ON public.compras FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER trigger_update_configuracoes BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Gatilho para atualizar saldo da caixinha após insert na tabela caixinhas
CREATE OR REPLACE FUNCTION update_user_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.usuarios
    SET saldo = NEW.saldo_apos_transacao
    WHERE id = NEW.usuario_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_after_caixinha_insert
AFTER INSERT ON public.caixinhas
FOR EACH ROW EXECUTE PROCEDURE update_user_balance();

-- Função Auto-geradora de Números (Escalável p/ 10M)
-- Em produção pesada, edge functions ou Redis são preferíveis p/ geração e bloqueios, 
-- mas isso garante infra robusta no Supabase
CREATE OR REPLACE FUNCTION gerar_numeros_rifa(v_premio_id UUID, v_quantidade INTEGER)
RETURNS INTEGER[] AS $$
DECLARE
    v_total_cotas INTEGER;
    v_vendidas INTEGER;
    v_numeros INTEGER[];
BEGIN
    -- Isso travaria a linha do premio para concorrência
    SELECT total_cotas, cotas_vendidas INTO v_total_cotas, v_vendidas
    FROM public.premios WHERE id = v_premio_id FOR UPDATE;

    IF v_vendidas + v_quantidade > v_total_cotas THEN
        RAISE EXCEPTION 'Quantidade indisponível';
    END IF;
    
    -- Atualiza total
    UPDATE public.premios SET cotas_vendidas = cotas_vendidas + v_quantidade 
    WHERE id = v_premio_id;

    -- Em um modelo de hiper escala:
    -- Pode-se fazer numeração sequencial a partir da "cotas_vendidas" antiga
    -- ou usar abordagens de sorteio aleatório base e verificação. 
    -- Faremos Sequencial por ser a única forma O(1) de escalar de 1 a 10M na emissão.
    SELECT array_agg(gs.val) INTO v_numeros
    FROM generate_series(v_vendidas + 1, v_vendidas + v_quantidade) AS gs(val);

    RETURN v_numeros;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- ATIVAR RLS EM TODAS AS TABELAS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ganhadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios_instantaneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_premios ENABLE ROW LEVEL SECURITY;

-- FUNÇÃO AUXILIAR DE VERIFICAÇÃO DE ADMIN
CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- POLÍTICAS: usuarios
CREATE POLICY "Users can view their own profile" ON public.usuarios FOR SELECT USING (id = auth.uid() OR auth.is_admin());
CREATE POLICY "Users can update their own profile" ON public.usuarios FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can view and manage all users" ON public.usuarios FOR ALL USING (auth.is_admin());

-- POLÍTICAS: premios
CREATE POLICY "Anyone can view active premios" ON public.premios FOR SELECT USING (status = 'active' OR status = 'completed' OR auth.is_admin());
CREATE POLICY "Admins can manage premios" ON public.premios FOR ALL USING (auth.is_admin());

-- POLÍTICAS: compras
CREATE POLICY "Users can view their own purchases" ON public.compras FOR SELECT USING (usuario_id = auth.uid() OR auth.is_admin());
CREATE POLICY "Users can insert purchases" ON public.compras FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "Admins can manage purchases" ON public.compras FOR ALL USING (auth.is_admin());

-- POLÍTICAS: ganhadores
CREATE POLICY "Anyone can view ganhadores" ON public.ganhadores FOR SELECT USING (true);
CREATE POLICY "Admins can manage ganhadores" ON public.ganhadores FOR ALL USING (auth.is_admin());

-- POLÍTICAS: stories
CREATE POLICY "Anyone can view active stories" ON public.stories FOR SELECT USING (ativo = true OR auth.is_admin());
CREATE POLICY "Admins can manage stories" ON public.stories FOR ALL USING (auth.is_admin());

-- POLÍTICAS: caixinhas
CREATE POLICY "Users can view own transactions" ON public.caixinhas FOR SELECT USING (usuario_id = auth.uid() OR auth.is_admin());
CREATE POLICY "Admins can manage caixinhas" ON public.caixinhas FOR ALL USING (auth.is_admin());

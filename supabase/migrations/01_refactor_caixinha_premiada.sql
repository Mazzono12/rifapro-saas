-- Refatoracao da Caixinha Premiada como bonus oculto pos-compra.
-- Mantem economia controlada por regras admin e historico auditavel.

CREATE TABLE IF NOT EXISTS public.caixinha_configuracoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  chave TEXT UNIQUE NOT NULL,
  valor JSONB NOT NULL,
  atualizado_por UUID REFERENCES public.usuarios(id),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.caixinha_premios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_premio TEXT NOT NULL CHECK (tipo_premio IN ('pix', 'cota_gratis', 'multiplas_cotas')),
  valor_premio DECIMAL(12,2) DEFAULT 0,
  cotas_bonus INTEGER DEFAULT 0,
  categoria TEXT NOT NULL CHECK (categoria IN ('mini', 'medio', 'alto')),
  a_cada_cotas_globais INTEGER NOT NULL CHECK (a_cada_cotas_globais > 0),
  contador_atual INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.caixinhas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES public.usuarios(id),
  compra_id UUID REFERENCES public.purchases(id),
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'opening', 'opened', 'cancelled')),
  premiada BOOLEAN DEFAULT FALSE,
  valor_premio DECIMAL(12,2) DEFAULT 0,
  tipo_premio TEXT,
  premio_id UUID REFERENCES public.caixinha_premios(id),
  data_abertura TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.caixinha_recompensas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  premio_id UUID REFERENCES public.caixinha_premios(id),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'delivered', 'expired')),
  liberado_por_cotas_globais INTEGER NOT NULL,
  caixinha_id UUID REFERENCES public.caixinhas(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  entregue_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.caixinha_historico (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  caixinha_id UUID REFERENCES public.caixinhas(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  compra_id UUID REFERENCES public.purchases(id),
  premiada BOOLEAN NOT NULL,
  valor_premio DECIMAL(12,2) DEFAULT 0,
  tipo_premio TEXT,
  payload JSONB,
  data_abertura TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixinhas_usuario_status ON public.caixinhas(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_caixinhas_compra ON public.caixinhas(compra_id);
CREATE INDEX IF NOT EXISTS idx_caixinha_recompensas_status ON public.caixinha_recompensas(status, criado_em);
CREATE INDEX IF NOT EXISTS idx_caixinha_historico_usuario ON public.caixinha_historico(usuario_id, data_abertura DESC);

ALTER TABLE public.caixinha_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixinha_premios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixinha_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixinha_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage caixinha config" ON public.caixinha_configuracoes
  FOR ALL USING (public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Admins manage caixinha prizes" ON public.caixinha_premios
  FOR ALL USING (public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Users view own hidden boxes" ON public.caixinhas
  FOR SELECT USING (usuario_id = auth.uid() OR public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Admins manage caixinhas" ON public.caixinhas
  FOR ALL USING (public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Admins manage caixinha rewards" ON public.caixinha_recompensas
  FOR ALL USING (public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Users view own caixinha history" ON public.caixinha_historico
  FOR SELECT USING (usuario_id = auth.uid() OR public.jwt_app_role() IN ('superadmin', 'tenant_admin'));
CREATE POLICY "Admins manage caixinha history" ON public.caixinha_historico
  FOR ALL USING (public.jwt_app_role() IN ('superadmin', 'tenant_admin'));

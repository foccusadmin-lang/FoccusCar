-- Foccus Car: políticas aplicadas após cada migration (idempotente).
-- 1) Isolamento por empresa (RLS)  2) Reservas sem conflito  3) Registros imutáveis  4) Permissões do papel da aplicação

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION app_current_company() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.company_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- 1) RLS em toda tabela com company_id (novas tabelas entram automaticamente).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND c.column_name = 'company_id' AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT IN ('payment_webhooks')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', r.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (company_id = app_current_company()) WITH CHECK (company_id = app_current_company())',
      r.table_name);
  END LOOP;
END $$;

-- O usuário enxerga os próprios vínculos em qualquer empresa (para escolher a empresa ativa).
DROP POLICY IF EXISTS member_self ON company_members;
CREATE POLICY member_self ON company_members FOR SELECT USING (user_id = app_current_user());

-- 2) Nenhuma reserva ativa sobreposta para o mesmo veículo (seção 32).
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_period_chk;
ALTER TABLE reservations ADD CONSTRAINT reservations_period_chk CHECK (return_at > pickup_at);
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_overlap;
ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (vehicle_id WITH =, tstzrange(pickup_at, return_at, '[)') WITH &&)
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED') AND deleted_at IS NULL AND vehicle_id IS NOT NULL);

ALTER TABLE rentals DROP CONSTRAINT IF EXISTS rentals_no_overlap;
ALTER TABLE rentals ADD CONSTRAINT rentals_no_overlap
  EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_at, coalesce(actual_return_at, expected_return_at), '[)') WITH &&)
  WHERE (status IN ('SCHEDULED', 'CHECKOUT_IN_PROGRESS', 'ACTIVE', 'RETURN_IN_PROGRESS') AND deleted_at IS NULL);

-- 3) Imutabilidade: auditoria, vida do veículo, eventos de pagamento e lançamentos confirmados.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável em %: use um lançamento de correção.', TG_TABLE_NAME USING ERRCODE = 'P0001';
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs', 'vehicle_events', 'payment_events', 'vehicle_history'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_immutable ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_mutation()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION protect_confirmed_financial() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lançamentos financeiros não são apagados: registre um estorno ou ajuste.' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status = 'CONFIRMED' THEN
    RAISE EXCEPTION 'Lançamento confirmado é imutável: registre um estorno ou ajuste.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS financial_transactions_protect ON financial_transactions;
CREATE TRIGGER financial_transactions_protect BEFORE UPDATE OR DELETE ON financial_transactions
  FOR EACH ROW EXECUTE FUNCTION protect_confirmed_financial();

-- 4) Papel usado pela aplicação: sem superusuário, sujeito a RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'foccus_app') THEN
    GRANT USAGE ON SCHEMA public TO foccus_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO foccus_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO foccus_app;
    REVOKE UPDATE, DELETE ON audit_logs, vehicle_events, payment_events, vehicle_history FROM foccus_app;
    REVOKE DELETE ON financial_transactions FROM foccus_app;
    REVOKE ALL ON drizzle.__drizzle_migrations FROM foccus_app;
  END IF;
END $$;

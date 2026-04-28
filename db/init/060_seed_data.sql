-- ============================================================================
-- DermaOS — Dados de Demonstração
-- Clínica DermaPrime (BH), 3 usuários, 5 pacientes, insumos, kits,
-- serviços, agendamentos e prontuários com SOAP completo
-- Todos os INSERTs usam ON CONFLICT (id) DO NOTHING para idempotência
-- ============================================================================

DO $$
DECLARE
  -- ── Clínica ──────────────────────────────────────────────────────────────
  v_clinic_id           UUID := 'a0000000-0000-0000-0000-000000000001';

  -- ── Usuários ─────────────────────────────────────────────────────────────
  v_user_owner_id       UUID := 'a0000000-0000-0000-0000-000000000010';
  v_user_doctor_id      UUID := 'a0000000-0000-0000-0000-000000000011';
  v_user_recep_id       UUID := 'a0000000-0000-0000-0000-000000000012';

  -- ── Pacientes ─────────────────────────────────────────────────────────────
  v_patient_1           UUID := 'a0000000-0000-0000-0000-000000000020';
  v_patient_2           UUID := 'a0000000-0000-0000-0000-000000000021';
  v_patient_3           UUID := 'a0000000-0000-0000-0000-000000000022';
  v_patient_4           UUID := 'a0000000-0000-0000-0000-000000000023';
  v_patient_5           UUID := 'a0000000-0000-0000-0000-000000000024';

  -- ── Supply: Categorias ────────────────────────────────────────────────────
  v_cat_injetaveis_id   UUID := 'a0000000-0000-0000-0000-000000000030';
  v_cat_cosmeticos_id   UUID := 'a0000000-0000-0000-0000-000000000031';

  -- ── Supply: Fornecedores ──────────────────────────────────────────────────
  v_supplier_1          UUID := 'a0000000-0000-0000-0000-000000000040';
  v_supplier_2          UUID := 'a0000000-0000-0000-0000-000000000041';

  -- ── Supply: Produtos (5 injetáveis + 5 cosméticos) ───────────────────────
  v_prod_botox_id       UUID := 'a0000000-0000-0000-0000-000000000050';
  v_prod_ha_id          UUID := 'a0000000-0000-0000-0000-000000000051';
  v_prod_vitc_inj_id    UUID := 'a0000000-0000-0000-0000-000000000052';
  v_prod_bioest_id      UUID := 'a0000000-0000-0000-0000-000000000053';
  v_prod_meso_id        UUID := 'a0000000-0000-0000-0000-000000000054';
  v_prod_fps_id         UUID := 'a0000000-0000-0000-0000-000000000055';
  v_prod_serum_id       UUID := 'a0000000-0000-0000-0000-000000000056';
  v_prod_hidrat_id      UUID := 'a0000000-0000-0000-0000-000000000057';
  v_prod_gel_id         UUID := 'a0000000-0000-0000-0000-000000000058';
  v_prod_tonico_id      UUID := 'a0000000-0000-0000-0000-000000000059';

  -- ── Supply: Kits ─────────────────────────────────────────────────────────
  v_kit_botox_id        UUID := 'a0000000-0000-0000-0000-000000000060';
  v_kit_preen_id        UUID := 'a0000000-0000-0000-0000-000000000061';
  v_kit_peeling_id      UUID := 'a0000000-0000-0000-0000-000000000062';

  -- ── Financial: Serviços ───────────────────────────────────────────────────
  v_svc_consulta_id     UUID := 'a0000000-0000-0000-0000-000000000070';
  v_svc_botox_id        UUID := 'a0000000-0000-0000-0000-000000000071';
  v_svc_preen_id        UUID := 'a0000000-0000-0000-0000-000000000072';
  v_svc_peeling_id      UUID := 'a0000000-0000-0000-0000-000000000073';
  v_svc_laser_id        UUID := 'a0000000-0000-0000-0000-000000000074';
  v_svc_micro_id        UUID := 'a0000000-0000-0000-0000-000000000075';
  v_svc_biopsia_id      UUID := 'a0000000-0000-0000-0000-000000000076';
  v_svc_meso_id         UUID := 'a0000000-0000-0000-0000-000000000077';
  v_svc_avaliacao_id    UUID := 'a0000000-0000-0000-0000-000000000078';
  v_svc_retorno_id      UUID := 'a0000000-0000-0000-0000-000000000079';

  -- ── Agendamentos (hoje = 2026-04-23) ─────────────────────────────────────
  v_appt_1              UUID := 'a0000000-0000-0000-0000-000000000080';
  v_appt_2              UUID := 'a0000000-0000-0000-0000-000000000081';
  v_appt_3              UUID := 'a0000000-0000-0000-0000-000000000082';
  v_appt_4              UUID := 'a0000000-0000-0000-0000-000000000083';
  v_appt_5              UUID := 'a0000000-0000-0000-0000-000000000084';

  -- ── Agendamentos passados (para encontros) ────────────────────────────────
  v_appt_past_1         UUID := 'a0000000-0000-0000-0000-000000000085';
  v_appt_past_2         UUID := 'a0000000-0000-0000-0000-000000000086';
  v_appt_past_3         UUID := 'a0000000-0000-0000-0000-000000000087';

  -- ── Encontros (prontuários) ───────────────────────────────────────────────
  v_enc_1               UUID := 'a0000000-0000-0000-0000-000000000090';
  v_enc_2               UUID := 'a0000000-0000-0000-0000-000000000091';
  v_enc_3               UUID := 'a0000000-0000-0000-0000-000000000092';

  -- ── Prescrições ───────────────────────────────────────────────────────────
  v_rx_1                UUID := 'a0000000-0000-0000-0000-000000000093';
  v_rx_2                UUID := 'a0000000-0000-0000-0000-000000000094';
  v_rx_3                UUID := 'a0000000-0000-0000-0000-000000000095';

  -- Senha@123, gerado com as mesmas opções Argon2id usadas pela API.
  v_default_password_hash TEXT := '$argon2id$v=19$m=65536,t=3,p=4$sN5xQcWH8dSR6IEWtqol4Q$MFnLX3vh2Kdo7oQIVRkUddDrUjQTnqca4ANv6v0skm8';

BEGIN
  -- Define contexto de tenant para RLS
  PERFORM set_config('app.current_clinic_id', v_clinic_id::TEXT, true);

  -- ════════════════════════════════════════════════════════════════════════════
  -- 1. CLÍNICA
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.clinics (
    id, name, slug, cnpj, phone, email, timezone,
    address, business_hours, appointment_config,
    cnes, plan, plan_limits, is_active, onboarded_at
  ) VALUES (
    v_clinic_id,
    'Clínica DermaPrime',
    'dermaprime',
    '12345678000195',
    '(31) 3333-4444',
    'contato@dermaprime.com.br',
    'America/Sao_Paulo',
    '{"street": "Av. Afonso Pena", "number": "1500", "complement": "Sala 301", "district": "Centro", "city": "Belo Horizonte", "state": "MG", "zip": "30130-921"}'::jsonb,
    '{"mon": {"open": "08:00", "close": "18:00"}, "tue": {"open": "08:00", "close": "18:00"}, "wed": {"open": "08:00", "close": "18:00"}, "thu": {"open": "08:00", "close": "18:00"}, "fri": {"open": "08:00", "close": "17:00"}, "sat": null, "sun": null}'::jsonb,
    '{"default_duration": 30, "buffer_time": 10, "max_advance_days": 90, "allow_online_booking": true}'::jsonb,
    '1234567',
    'professional',
    '{"max_patients": 5000, "max_users": 20, "max_monthly_appointments": 1000}'::jsonb,
    TRUE,
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 2. USUÁRIOS
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.users (
    id, clinic_id, name, email, password_hash, role,
    crm, is_active, is_email_verified, created_at
  ) VALUES
  (
    v_user_owner_id, v_clinic_id,
    'Admin DermaPrime', 'admin@dermaprime.com.br',
    v_default_password_hash,
    'owner', NULL, TRUE, TRUE, NOW()
  ),
  (
    v_user_doctor_id, v_clinic_id,
    'Dr. Henrique Costa', 'henrique@dermaprime.com.br',
    v_default_password_hash,
    'dermatologist', 'CRM-MG 12345', TRUE, TRUE, NOW()
  ),
  (
    v_user_recep_id, v_clinic_id,
    'Ana Lima', 'ana@dermaprime.com.br',
    v_default_password_hash,
    'receptionist', NULL, TRUE, TRUE, NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 3. PACIENTES
  -- Dados PHI: a fonte canônica é sempre o pipeline de criptografia da API.
  -- Este seed SQL cria fixtures locais antes da API estar disponível; após o
  -- bootstrap, execute:
  --   pnpm --filter @dermaos/api patient-phi:encrypt-legacy
  -- O comando converte estes nomes para AES-256-GCM de forma idempotente.
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.patients (
    id, clinic_id,
    name, name_search,
    cpf_hash,
    birth_date, gender, blood_type,
    allergies, chronic_conditions,
    status, source_channel,
    total_visits, first_visit_at, last_visit_at,
    created_at, created_by
  ) VALUES
  (
    v_patient_1, v_clinic_id,
    'Mariana Silva Santos', lower(unaccent('Mariana Silva Santos')),
    encode(digest('111.111.111-11', 'sha256'), 'hex'),
    '1988-03-15', 'female', 'A+',
    ARRAY['dipirona']::TEXT[], ARRAY['melasma']::TEXT[],
    'active', 'referral',
    3, '2025-10-10', '2026-04-05', NOW(), v_user_recep_id
  ),
  (
    v_patient_2, v_clinic_id,
    'Carlos Eduardo Oliveira', lower(unaccent('Carlos Eduardo Oliveira')),
    encode(digest('222.222.222-22', 'sha256'), 'hex'),
    '1975-07-22', 'male', 'O-',
    ARRAY[]::TEXT[], ARRAY['dermatite seborreica']::TEXT[],
    'active', 'whatsapp',
    2, '2025-12-01', '2026-04-05', NOW(), v_user_recep_id
  ),
  (
    v_patient_3, v_clinic_id,
    'Fernanda Rocha Mendes', lower(unaccent('Fernanda Rocha Mendes')),
    encode(digest('333.333.333-33', 'sha256'), 'hex'),
    '1995-11-08', 'female', 'B+',
    ARRAY['penicilina']::TEXT[], ARRAY['acne grau II']::TEXT[],
    'active', 'online_booking',
    1, '2026-03-28', '2026-03-28', NOW(), v_user_recep_id
  ),
  (
    v_patient_4, v_clinic_id,
    'João Pedro Alves', lower(unaccent('João Pedro Alves')),
    encode(digest('444.444.444-44', 'sha256'), 'hex'),
    '1982-05-30', 'male', 'AB+',
    ARRAY[]::TEXT[], ARRAY[]::TEXT[],
    'active', 'phone',
    0, NULL, NULL, NOW(), v_user_recep_id
  ),
  (
    v_patient_5, v_clinic_id,
    'Luciana Teixeira Gomes', lower(unaccent('Luciana Teixeira Gomes')),
    encode(digest('555.555.555-55', 'sha256'), 'hex'),
    '1991-09-12', 'female', 'O+',
    ARRAY[]::TEXT[], ARRAY['psoríase']::TEXT[],
    'active', 'referral',
    0, NULL, NULL, NOW(), v_user_recep_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 4. CATEGORIAS DE SUPRIMENTOS
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO supply.categories (id, clinic_id, name, description, is_active) VALUES
  (v_cat_injetaveis_id, v_clinic_id, 'Injetáveis', 'Toxinas, preenchedores e bioestimuladores', TRUE),
  (v_cat_cosmeticos_id, v_clinic_id, 'Cosméticos', 'Protetores solares, séruns e cremes', TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 5. FORNECEDORES
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO supply.suppliers (
    id, clinic_id, name, cnpj, contact_name, phone, email,
    payment_terms, lead_time_days, is_active
  ) VALUES
  (
    v_supplier_1, v_clinic_id,
    'Distribuidora MedSupply', '98765432000101',
    'Rodrigo Faria', '(11) 9999-8888', 'vendas@medsupply.com.br',
    '30 dias', 5, TRUE
  ),
  (
    v_supplier_2, v_clinic_id,
    'DermaCosméticos LTDA', '11223344000155',
    'Paula Souza', '(11) 7777-6666', 'contato@dermacosmeticos.com.br',
    '15 dias', 3, TRUE
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 6. PRODUTOS
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO supply.products (
    id, clinic_id, category_id, preferred_supplier_id,
    name, sku, unit, unit_cost, markup_pct,
    is_controlled, min_stock, reorder_point,
    anvisa_registration, is_active
  ) VALUES
  -- Injetáveis
  (v_prod_botox_id,    v_clinic_id, v_cat_injetaveis_id, v_supplier_1,
   'Toxina Botulínica 100U', 'INJ-001', 'frasco', 350.00, 150.00,
   TRUE, 5, 10, 'ANVISA-12345-6', TRUE),

  (v_prod_ha_id,       v_clinic_id, v_cat_injetaveis_id, v_supplier_1,
   'Ácido Hialurônico 1ml', 'INJ-002', 'seringa', 280.00, 200.00,
   FALSE, 10, 20, 'ANVISA-23456-7', TRUE),

  (v_prod_vitc_inj_id, v_clinic_id, v_cat_injetaveis_id, v_supplier_1,
   'Vitamina C 10ml Injetável', 'INJ-003', 'ampola', 45.00, 300.00,
   FALSE, 20, 40, 'ANVISA-34567-8', TRUE),

  (v_prod_bioest_id,   v_clinic_id, v_cat_injetaveis_id, v_supplier_1,
   'Bioestimulador de Colágeno 200mg', 'INJ-004', 'frasco', 420.00, 180.00,
   FALSE, 5, 10, 'ANVISA-45678-9', TRUE),

  (v_prod_meso_id,     v_clinic_id, v_cat_injetaveis_id, v_supplier_1,
   'Meso Cocktail Capilar 10ml', 'INJ-005', 'ampola', 60.00, 250.00,
   FALSE, 15, 30, NULL, TRUE),

  -- Cosméticos
  (v_prod_fps_id,      v_clinic_id, v_cat_cosmeticos_id, v_supplier_2,
   'Protetor Solar FPS 60 50g', 'COS-001', 'unidade', 28.00, 200.00,
   FALSE, 30, 50, NULL, TRUE),

  (v_prod_serum_id,    v_clinic_id, v_cat_cosmeticos_id, v_supplier_2,
   'Sérum Vitamina C 15% 30ml', 'COS-002', 'unidade', 65.00, 180.00,
   FALSE, 15, 25, NULL, TRUE),

  (v_prod_hidrat_id,   v_clinic_id, v_cat_cosmeticos_id, v_supplier_2,
   'Creme Hidratante Facial 50g', 'COS-003', 'unidade', 32.00, 200.00,
   FALSE, 20, 35, NULL, TRUE),

  (v_prod_gel_id,      v_clinic_id, v_cat_cosmeticos_id, v_supplier_2,
   'Gel de Limpeza Facial 150ml', 'COS-004', 'unidade', 22.00, 220.00,
   FALSE, 25, 40, NULL, TRUE),

  (v_prod_tonico_id,   v_clinic_id, v_cat_cosmeticos_id, v_supplier_2,
   'Tônico Facial Refrescante 100ml', 'COS-005', 'unidade', 18.00, 250.00,
   FALSE, 20, 35, NULL, TRUE)

  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 7. KITS DE PROCEDIMENTO
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO supply.kit_templates (id, clinic_id, name, description, is_active, created_by) VALUES
  (v_kit_botox_id,  v_clinic_id, 'Kit Botox Básico',        'Kit padrão para aplicação de toxina botulínica', TRUE, v_user_doctor_id),
  (v_kit_preen_id,  v_clinic_id, 'Kit Preenchimento Labial', 'Kit para preenchimento com ácido hialurônico',   TRUE, v_user_doctor_id),
  (v_kit_peeling_id, v_clinic_id, 'Kit Peeling Químico',    'Kit completo para peeling químico superficial',  TRUE, v_user_doctor_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO supply.kit_items (id, clinic_id, kit_template_id, product_id, quantity) VALUES
  -- Kit Botox
  (uuid_generate_v4(), v_clinic_id, v_kit_botox_id,  v_prod_botox_id,  1),
  (uuid_generate_v4(), v_clinic_id, v_kit_botox_id,  v_prod_vitc_inj_id, 2),
  -- Kit Preenchimento
  (uuid_generate_v4(), v_clinic_id, v_kit_preen_id,  v_prod_ha_id,     2),
  (uuid_generate_v4(), v_clinic_id, v_kit_preen_id,  v_prod_vitc_inj_id, 1),
  -- Kit Peeling
  (uuid_generate_v4(), v_clinic_id, v_kit_peeling_id, v_prod_fps_id,   1),
  (uuid_generate_v4(), v_clinic_id, v_kit_peeling_id, v_prod_gel_id,   1),
  (uuid_generate_v4(), v_clinic_id, v_kit_peeling_id, v_prod_hidrat_id, 1)
  ON CONFLICT DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 8. SERVIÇOS OPERACIONAIS + CATÁLOGO DE SERVIÇOS FINANCEIROS
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.services (
    id, clinic_id, name, description, category, duration_min, price,
    allow_online, requires_provider, color, is_active
  ) VALUES
  (v_svc_consulta_id,  v_clinic_id, 'Consulta Dermatológica',         'Consulta clínica dermatológica',                 'Consulta',               30,  250.00, TRUE, TRUE, '#2563eb', TRUE),
  (v_svc_botox_id,     v_clinic_id, 'Toxina Botulínica (por região)', 'Aplicação de toxina botulínica por região',      'Procedimento Estético', 45,  800.00, TRUE, TRUE, '#7c3aed', TRUE),
  (v_svc_preen_id,     v_clinic_id, 'Preenchimento com HA',           'Preenchimento com ácido hialurônico',            'Procedimento Estético', 60,  900.00, TRUE, TRUE, '#db2777', TRUE),
  (v_svc_peeling_id,   v_clinic_id, 'Peeling Químico Superficial',    'Peeling químico superficial',                    'Procedimento Estético', 45,  350.00, TRUE, TRUE, '#ea580c', TRUE),
  (v_svc_laser_id,     v_clinic_id, 'Laser Fracionado',               'Sessão de laser fracionado',                     'Procedimento Estético', 60, 1200.00, TRUE, TRUE, '#0891b2', TRUE),
  (v_svc_micro_id,     v_clinic_id, 'Microagulhamento',               'Sessão de microagulhamento',                     'Procedimento Estético', 60,  600.00, TRUE, TRUE, '#16a34a', TRUE),
  (v_svc_biopsia_id,   v_clinic_id, 'Biópsia Cutânea',                'Biópsia cutânea ambulatorial',                   'Procedimento Cirúrgico',30,  450.00, TRUE, TRUE, '#dc2626', TRUE),
  (v_svc_meso_id,      v_clinic_id, 'Mesoterapia Capilar',            'Sessão de mesoterapia capilar',                  'Procedimento Estético', 45,  500.00, TRUE, TRUE, '#4f46e5', TRUE),
  (v_svc_avaliacao_id, v_clinic_id, 'Avaliação Estética',             'Avaliação estética inicial',                     'Consulta',               30,  180.00, TRUE, TRUE, '#0d9488', TRUE),
  (v_svc_retorno_id,   v_clinic_id, 'Consulta Retorno',               'Retorno dermatológico',                          'Consulta',               20,  150.00, TRUE, TRUE, '#475569', TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO financial.service_catalog (
    id, clinic_id, name, category, tuss_code, price, duration_min, is_active
  ) VALUES
  (v_svc_consulta_id,  v_clinic_id, 'Consulta Dermatológica',         'consulta',              '10101012', 250.00, 30, TRUE),
  (v_svc_botox_id,     v_clinic_id, 'Toxina Botulínica (por região)', 'procedimento_estetico', NULL,       800.00, 45, TRUE),
  (v_svc_preen_id,     v_clinic_id, 'Preenchimento com HA',           'procedimento_estetico', NULL,       900.00, 60, TRUE),
  (v_svc_peeling_id,   v_clinic_id, 'Peeling Químico Superficial',    'procedimento_estetico', NULL,       350.00, 45, TRUE),
  (v_svc_laser_id,     v_clinic_id, 'Laser Fracionado',               'procedimento_estetico', NULL,      1200.00, 60, TRUE),
  (v_svc_micro_id,     v_clinic_id, 'Microagulhamento',               'procedimento_estetico', NULL,       600.00, 60, TRUE),
  (v_svc_biopsia_id,   v_clinic_id, 'Biópsia Cutânea',                'procedimento_cirurgico','30909026', 450.00, 30, TRUE),
  (v_svc_meso_id,      v_clinic_id, 'Mesoterapia Capilar',            'procedimento_estetico', NULL,       500.00, 45, TRUE),
  (v_svc_avaliacao_id, v_clinic_id, 'Avaliação Estética',             'consulta',              NULL,       180.00, 30, TRUE),
  (v_svc_retorno_id,   v_clinic_id, 'Consulta Retorno',               'consulta',              '10101012', 150.00, 20, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 9. AGENDAMENTOS PASSADOS (para encontros)
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.appointments (
    id, clinic_id, patient_id, provider_id, service_id,
    type, scheduled_at, duration_min, status, source,
    payment_status, price, created_at, created_by
  ) VALUES
  (
    v_appt_past_1, v_clinic_id, v_patient_1, v_user_doctor_id, v_svc_consulta_id,
    'clinical', '2026-04-10 09:00:00-03', 30, 'completed', 'manual',
    'paid', 250.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_past_2, v_clinic_id, v_patient_2, v_user_doctor_id, v_svc_consulta_id,
    'clinical', '2026-04-05 10:00:00-03', 30, 'completed', 'whatsapp',
    'paid', 250.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_past_3, v_clinic_id, v_patient_3, v_user_doctor_id, v_svc_retorno_id,
    'followup', '2026-03-28 14:00:00-03', 20, 'completed', 'online_booking',
    'paid', 150.00, NOW(), v_user_recep_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 10. AGENDAMENTOS DE HOJE (2026-04-23)
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO shared.appointments (
    id, clinic_id, patient_id, provider_id, service_id,
    type, scheduled_at, duration_min, status, source,
    payment_status, price, created_at, created_by
  ) VALUES
  (
    v_appt_1, v_clinic_id, v_patient_1, v_user_doctor_id, v_svc_retorno_id,
    'followup', '2026-04-23 08:00:00-03', 20, 'confirmed', 'whatsapp',
    'pending', 150.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_2, v_clinic_id, v_patient_2, v_user_doctor_id, v_svc_botox_id,
    'aesthetic', '2026-04-23 09:00:00-03', 45, 'confirmed', 'phone',
    'pending', 800.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_3, v_clinic_id, v_patient_3, v_user_doctor_id, v_svc_peeling_id,
    'aesthetic', '2026-04-23 10:30:00-03', 45, 'scheduled', 'online_booking',
    'pending', 350.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_4, v_clinic_id, v_patient_4, v_user_doctor_id, v_svc_consulta_id,
    'clinical', '2026-04-23 14:00:00-03', 30, 'scheduled', 'phone',
    'pending', 250.00, NOW(), v_user_recep_id
  ),
  (
    v_appt_5, v_clinic_id, v_patient_5, v_user_doctor_id, v_svc_avaliacao_id,
    'aesthetic', '2026-04-23 15:30:00-03', 30, 'scheduled', 'referral',
    'pending', 180.00, NOW(), v_user_recep_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 11. PRONTUÁRIOS (ENCOUNTERS) COM SOAP COMPLETO
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO clinical.encounters (
    id, clinic_id, patient_id, provider_id, appointment_id,
    type, status,
    chief_complaint, subjective, objective, assessment, plan,
    diagnoses, structured_data,
    signed_at, signed_by, signature_hash,
    created_at, created_by
  ) VALUES
  -- Encontro 1: Mariana — Melasma facial (2026-04-10)
  (
    v_enc_1, v_clinic_id, v_patient_1, v_user_doctor_id, v_appt_past_1,
    'clinical', 'assinado',
    'Manchas escuras no rosto há cerca de 6 meses, piora com exposição solar',
    'Paciente relata aparecimento progressivo de manchas hipercrômicas na face após período de gestação e exposição solar intensa. Nega tratamento prévio. Usa protetor solar ocasionalmente. Sem história familiar de melasma.',
    'Paciente em bom estado geral, normocorada, hidratada. Ao exame dermatológico: máculas hipercrômicas de coloração castanha, simétricas, em região centrofacial (fronte, dorso nasal e lábio superior). Padrão misto à dermatoscopia. Wood: acentuação sob luz UV.',
    'Melasma facial grau II, padrão centrofacial. Fotoproteção inadequada como fator de piora. Sem sinais de lesão maligna associada.',
    'Iniciar uso de protetor solar FPS 60 diário, manhã e tarde. Prescrever creme clareador com ácido kójico 2% + niacinamida 4% à noite. Orientar sobre evitar exposição solar sem proteção. Retorno em 60 dias para avaliação de resposta ao tratamento. Considerar peeling químico superficial no retorno caso resposta inadequada.',
    ARRAY['L81.1']::TEXT[],
    '{"fotoprotetor_habitual": false, "tempo_lesao_meses": 6, "fator_gatilho": "gestacao_e_sol", "padrao_dermoscopia": "misto", "wood_lamp": "acentuado"}'::jsonb,
    '2026-04-10 11:30:00-03', v_user_doctor_id,
    encode(digest('enc_1_signed_content_hash', 'sha256'), 'hex'),
    '2026-04-10 09:30:00-03', v_user_doctor_id
  ),
  -- Encontro 2: Carlos — Dermatite seborreica (2026-04-05)
  (
    v_enc_2, v_clinic_id, v_patient_2, v_user_doctor_id, v_appt_past_2,
    'clinical', 'assinado',
    'Descamação e vermelhidão no couro cabeludo e nas sobrancelhas há 3 meses',
    'Paciente masculino refere lesões descamativas pruriginosas em couro cabeludo, sobrancelhas e sulcos nasogenianos. Piora em períodos de estresse e no inverno. Já usou xampu anticaspa sem resultado satisfatório. Histórico de dermatite seborreica há 5 anos com períodos de remissão.',
    'Eritema e descamação gordurosa em couro cabeludo (grau moderado), sobrancelhas espessadas com escamas branco-amareladas e sulcos nasogenianos eritematosos. Sem lesões em outras topografias. Sem linfadenopatia.',
    'Dermatite seborreica moderada, comprometendo couro cabeludo, face e sulcos nasogenianos. Fase de exacerbação.',
    'Xampu de cetoconazol 2% em dias alternados por 4 semanas; após controle, uso semanal de manutenção. Creme de propionato de clobetasol 0,05% nos sulcos nasogenianos 2x/dia por 7 dias. Orientação sobre fatores desencadeantes (estresse, frio). Retorno em 30 dias.',
    ARRAY['L21.0', 'L21.9']::TEXT[],
    '{"grau_couro_cabeludo": "moderado", "topografias": ["couro_cabeludo", "sobrancelhas", "sulcos_nasogenianos"], "fase": "exacerbacao"}'::jsonb,
    '2026-04-05 11:15:00-03', v_user_doctor_id,
    encode(digest('enc_2_signed_content_hash', 'sha256'), 'hex'),
    '2026-04-05 10:05:00-03', v_user_doctor_id
  ),
  -- Encontro 3: Fernanda — Acne grau II, retorno (2026-03-28)
  (
    v_enc_3, v_clinic_id, v_patient_3, v_user_doctor_id, v_appt_past_3,
    'followup', 'assinado',
    'Retorno — avaliação de resposta ao tratamento de acne iniciado há 60 dias',
    'Paciente relata melhora significativa das lesões inflamatórias após 60 dias de tratamento com adapaleno gel 0,1% à noite e peróxido de benzoíla 5% pela manhã. Refere ressecamento leve nos primeiros 15 dias, já resolvido. Mantém oleosidade na zona T. Nega novas lesões císticas.',
    'Redução de aproximadamente 70% das lesões papulopustulosas em comparação à consulta anterior. Persistência de comedões abertos em zona T. Sem lesões císticas ativas. Hiperpigmentação pós-inflamatória residual em região malar bilateral.',
    'Acne vulgar grau II em evolução favorável após 60 dias de terapia tópica combinada. Hiperpigmentação pós-inflamatória residual.',
    'Manter adapaleno gel 0,1% à noite e peróxido de benzoíla 5% pela manhã por mais 60 dias. Adicionar niacinamida 10% tópica para hiperpigmentação pós-inflamatória 2x/dia. Reforçar fotoproteção FPS 60 diário. Retorno em 60 dias; avaliar necessidade de tratamento sistêmico caso não haja resolução completa.',
    ARRAY['L70.0']::TEXT[],
    '{"grau_acne": "II", "reducao_lesoes_pct": 70, "tipo_predominante": "papulopustulosa", "hpif": true, "topografia_principal": "zona_T_malar"}'::jsonb,
    '2026-03-28 15:00:00-03', v_user_doctor_id,
    encode(digest('enc_3_signed_content_hash', 'sha256'), 'hex'),
    '2026-03-28 14:05:00-03', v_user_doctor_id
  )
  ON CONFLICT (id) DO NOTHING;

  -- ════════════════════════════════════════════════════════════════════════════
  -- 12. PRESCRIÇÕES
  -- ════════════════════════════════════════════════════════════════════════════

  INSERT INTO clinical.prescriptions (
    id, clinic_id, encounter_id, patient_id, prescriber_id,
    type, status, items, notes, valid_until,
    prescription_number, created_at
  ) VALUES
  -- Rx 1: Mariana — creme clareador + protetor solar (tópica)
  (
    v_rx_1, v_clinic_id, v_enc_1, v_patient_1, v_user_doctor_id,
    'topica', 'emitida',
    '[
      {
        "medication": "Ácido kójico 2% + Niacinamida 4%",
        "concentration": "Creme clareador",
        "vehicle": "Base creme",
        "quantity": "50g",
        "application_site": "Face, nas áreas afetadas",
        "frequency": "1x ao dia, à noite",
        "duration": "60 dias",
        "instructions": "Aplicar pequena quantidade nas manchas após limpeza do rosto. Evitar área periocular."
      },
      {
        "medication": "Protetor Solar FPS 60",
        "concentration": "Produto cosmético",
        "vehicle": "Gel-creme",
        "quantity": "50g",
        "application_site": "Face, pescoço e colo",
        "frequency": "2x ao dia (manhã e almoço)",
        "duration": "Uso contínuo",
        "instructions": "Aplicar 20 minutos antes da exposição solar. Reaplicar a cada 2 horas em exposição prolongada."
      }
    ]'::jsonb,
    'Paciente orientada sobre a importância da fotoproteção rigorosa para o sucesso do tratamento do melasma.',
    '2026-06-10',
    'RX-2026-0042', '2026-04-10 11:30:00-03'
  ),
  -- Rx 2: Carlos — cetoconazol xampu + corticoide (tópica)
  (
    v_rx_2, v_clinic_id, v_enc_2, v_patient_2, v_user_doctor_id,
    'topica', 'emitida',
    '[
      {
        "medication": "Cetoconazol 2%",
        "concentration": "Xampu",
        "vehicle": "Xampu",
        "quantity": "100ml",
        "application_site": "Couro cabeludo",
        "frequency": "Em dias alternados por 4 semanas; após, 1x por semana",
        "duration": "Uso contínuo (manutenção)",
        "instructions": "Aplicar no couro cabeludo úmido, deixar agir por 5 minutos e enxaguar."
      },
      {
        "medication": "Propionato de Clobetasol 0,05%",
        "concentration": "Creme",
        "vehicle": "Creme",
        "quantity": "15g",
        "application_site": "Sulcos nasogenianos",
        "frequency": "2x ao dia",
        "duration": "7 dias",
        "instructions": "Aplicar fina camada nas áreas afetadas. Não usar por mais de 7 dias sem reavaliação médica."
      }
    ]'::jsonb,
    'Orientado sobre fatores desencadeantes da dermatite seborreica: estresse, frio, álcool.',
    '2026-07-05',
    'RX-2026-0043', '2026-04-05 11:15:00-03'
  ),
  -- Rx 3: Fernanda — adapaleno + BPO + niacinamida (tópica)
  (
    v_rx_3, v_clinic_id, v_enc_3, v_patient_3, v_user_doctor_id,
    'topica', 'emitida',
    '[
      {
        "medication": "Adapaleno 0,1%",
        "concentration": "Gel",
        "vehicle": "Gel",
        "quantity": "30g",
        "application_site": "Face toda (zona T e malar)",
        "frequency": "1x ao dia, à noite",
        "duration": "60 dias",
        "instructions": "Aplicar fina camada após limpeza e secagem da face. Iniciar com uso em dias alternados nas primeiras 2 semanas para reduzir irritação."
      },
      {
        "medication": "Peróxido de Benzoíla 5%",
        "concentration": "Gel",
        "vehicle": "Gel",
        "quantity": "30g",
        "application_site": "Zona T (testa, nariz e queixo)",
        "frequency": "1x ao dia, pela manhã",
        "duration": "60 dias",
        "instructions": "Aplicar após limpeza. Pode causar ressecamento inicial — usar hidratante oil-free se necessário. Evitar contato com roupas e cabelos (pode descolorir)."
      },
      {
        "medication": "Niacinamida 10%",
        "concentration": "Sérum",
        "vehicle": "Sérum aquoso",
        "quantity": "30ml",
        "application_site": "Manchas pós-inflamatórias na região malar",
        "frequency": "2x ao dia",
        "duration": "60 dias",
        "instructions": "Aplicar após limpeza, antes do hidratante e protetor solar."
      }
    ]'::jsonb,
    'Paciente orientada sobre progressão esperada: melhora das manchas em 8-12 semanas. Reforçar fotoproteção diária.',
    '2026-05-28',
    'RX-2026-0044', '2026-03-28 15:00:00-03'
  )
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ============================================================================
-- DermaOS — CID-10 Reference Table
-- Tabela de referência global (não-multi-tenant) com códigos CID-10 usados
-- com maior frequência em dermatologia. Seed inicial pequeno — em produção,
-- esta tabela é populada via script de import da tabela oficial do DATASUS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinical.cid10_codes (
  code         VARCHAR(10) PRIMARY KEY,
  description  TEXT        NOT NULL,
  category     TEXT,
  chapter      TEXT,
  search_text  TEXT        GENERATED ALWAYS AS (
                 LOWER(code || ' ' || description || ' ' || COALESCE(category, ''))
               ) STORED
);

CREATE INDEX IF NOT EXISTS idx_cid10_search ON clinical.cid10_codes USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cid10_category ON clinical.cid10_codes (category);

GRANT SELECT ON clinical.cid10_codes TO dermaos_app, dermaos_readonly, dermaos_worker;

-- ─── Seed — códigos dermatológicos mais comuns ───────────────────────────────

INSERT INTO clinical.cid10_codes (code, description, category, chapter) VALUES
  ('L20.9', 'Dermatite atópica não especificada',                    'Dermatites',          'XII'),
  ('L21.0', 'Seborreia do couro cabeludo',                           'Dermatites',          'XII'),
  ('L21.9', 'Dermatite seborreica não especificada',                 'Dermatites',          'XII'),
  ('L23.9', 'Dermatite alérgica de contato, causa não especificada', 'Dermatites',          'XII'),
  ('L24.9', 'Dermatite de contato por irritantes, causa não especificada', 'Dermatites',    'XII'),
  ('L25.9', 'Dermatite de contato não especificada, causa não especificada', 'Dermatites',  'XII'),
  ('L29.8', 'Outro prurido',                                         'Prurido',             'XII'),
  ('L29.9', 'Prurido não especificado',                              'Prurido',             'XII'),
  ('L30.9', 'Dermatite não especificada',                            'Dermatites',          'XII'),
  ('L40.0', 'Psoríase vulgar',                                       'Psoríase',            'XII'),
  ('L40.1', 'Psoríase pustulosa generalizada',                       'Psoríase',            'XII'),
  ('L40.4', 'Psoríase gutata',                                       'Psoríase',            'XII'),
  ('L40.5', 'Artropatia psoriásica',                                 'Psoríase',            'XII'),
  ('L40.8', 'Outras formas de psoríase',                             'Psoríase',            'XII'),
  ('L40.9', 'Psoríase não especificada',                             'Psoríase',            'XII'),
  ('L42',   'Pitiríase rósea',                                       'Pápulo-escamosas',    'XII'),
  ('L43.9', 'Líquen plano não especificado',                         'Pápulo-escamosas',    'XII'),
  ('L50.0', 'Urticária alérgica',                                    'Urticária',           'XII'),
  ('L50.8', 'Outras urticárias',                                     'Urticária',           'XII'),
  ('L50.9', 'Urticária não especificada',                            'Urticária',           'XII'),
  ('L53.9', 'Afecção eritematosa não especificada',                  'Eritemas',            'XII'),
  ('L57.0', 'Queratose actínica',                                    'Fotodermatoses',      'XII'),
  ('L60.0', 'Unha encravada',                                        'Doenças das unhas',   'XII'),
  ('L63.9', 'Alopecia areata não especificada',                      'Alopecias',           'XII'),
  ('L64.8', 'Outras alopecias androgênicas',                         'Alopecias',           'XII'),
  ('L64.9', 'Alopecia androgênica não especificada',                 'Alopecias',           'XII'),
  ('L65.9', 'Queda de cabelo não cicatricial não especificada',      'Alopecias',           'XII'),
  ('L70.0', 'Acne vulgar',                                           'Acne',                'XII'),
  ('L70.1', 'Acne conglobata',                                       'Acne',                'XII'),
  ('L70.2', 'Acne varioliforme',                                     'Acne',                'XII'),
  ('L70.8', 'Outras formas de acne',                                 'Acne',                'XII'),
  ('L70.9', 'Acne não especificada',                                 'Acne',                'XII'),
  ('L71.0', 'Dermatite perioral',                                    'Rosácea',             'XII'),
  ('L71.9', 'Rosácea não especificada',                              'Rosácea',             'XII'),
  ('L72.0', 'Cisto epidérmico',                                      'Cistos cutâneos',     'XII'),
  ('L72.1', 'Cisto tricodérmico',                                    'Cistos cutâneos',     'XII'),
  ('L80',   'Vitiligo',                                              'Pigmentação',         'XII'),
  ('L81.0', 'Hiperpigmentação pós-inflamatória',                     'Pigmentação',         'XII'),
  ('L81.4', 'Outras hiperpigmentações por melanina',                 'Pigmentação',         'XII'),
  ('L82',   'Queratose seborreica',                                  'Lesões epidérmicas',  'XII'),
  ('L85.3', 'Xerose cutânea',                                        'Outras',              'XII'),
  ('L90.5', 'Afecções cicatriciais e fibrose da pele',               'Cicatrizes',          'XII'),
  ('L91.0', 'Cicatriz queloide',                                     'Cicatrizes',          'XII'),
  ('L98.0', 'Granuloma piogênico',                                   'Outras',              'XII'),
  ('L98.8', 'Outras afecções especificadas da pele e tecido subcutâneo', 'Outras',         'XII'),
  ('L98.9', 'Afecção da pele e do tecido subcutâneo, não especificada', 'Outras',          'XII'),
  ('C43.9', 'Melanoma maligno da pele, não especificado',            'Neoplasias malignas', 'II'),
  ('C44.3', 'Neoplasia maligna da pele de outras partes e de partes não especificadas da face', 'Neoplasias malignas', 'II'),
  ('C44.9', 'Neoplasia maligna da pele, não especificada',           'Neoplasias malignas', 'II'),
  ('D22.9', 'Nevo melanocítico, não especificado',                   'Neoplasias benignas', 'II'),
  ('D23.9', 'Neoplasia benigna da pele, não especificada',           'Neoplasias benignas', 'II'),
  ('B07',   'Verrugas virais',                                       'Infecções virais',    'I'),
  ('B00.1', 'Dermatite vesicular por herpesvírus',                   'Infecções virais',    'I'),
  ('B35.2', 'Tinha das mãos',                                        'Dermatofitoses',      'I'),
  ('B35.3', 'Tinha dos pés',                                         'Dermatofitoses',      'I'),
  ('B35.4', 'Tinha do corpo',                                        'Dermatofitoses',      'I'),
  ('B35.5', 'Tinha imbricada',                                       'Dermatofitoses',      'I'),
  ('B35.9', 'Dermatofitose não especificada',                        'Dermatofitoses',      'I'),
  ('B36.0', 'Pitiríase versicolor',                                  'Micoses superficiais', 'I'),
  ('B36.9', 'Micose superficial não especificada',                   'Micoses superficiais', 'I'),
  ('B37.2', 'Candidíase da pele e das unhas',                        'Candidíase',          'I'),
  ('B86',   'Escabiose',                                             'Infestações',         'I'),
  ('L01.0', 'Impetigo',                                              'Infecções bacterianas', 'XII'),
  ('L02.9', 'Abscesso cutâneo, furúnculo e antraz, não especificado', 'Infecções bacterianas', 'XII'),
  ('L03.9', 'Celulite não especificada',                             'Infecções bacterianas', 'XII'),
  ('Z01.5', 'Consulta para exame dermatológico preventivo',          'Exames/Acompanhamento', 'XXI'),
  ('Z09.9', 'Consulta de controle após tratamento',                  'Exames/Acompanhamento', 'XXI')
ON CONFLICT (code) DO NOTHING;

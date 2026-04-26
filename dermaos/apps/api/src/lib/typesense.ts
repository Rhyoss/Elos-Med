import Typesense from 'typesense';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host:     env.TYPESENSE_HOST,
      port:     env.TYPESENSE_PORT,
      protocol: 'http',
    },
  ],
  apiKey:                   env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 5,
  retryIntervalSeconds:     0.1,
  numRetries:               2,
});

const PATIENT_COLLECTION = 'patients';

export interface PatientDocument {
  id:            string;
  clinic_id:     string;
  name:          string;
  name_search:   string;
  phone:         string;
  status:        string;
  age:           number;
  birth_date:    string;
  created_at:    number;
  last_visit_at: number;
  total_visits:  number;
}

/**
 * Idempotente — cria a collection apenas se não existir.
 * Chamada no bootstrap do módulo de pacientes.
 */
export async function ensurePatientCollection(): Promise<void> {
  try {
    await typesenseClient.collections(PATIENT_COLLECTION).retrieve();
  } catch {
    try {
      await typesenseClient.collections().create({
        name: PATIENT_COLLECTION,
        fields: [
          { name: 'clinic_id',     type: 'string', facet: true },
          { name: 'name',          type: 'string'               },
          { name: 'name_search',   type: 'string'               },
          { name: 'phone',         type: 'string', optional: true },
          { name: 'status',        type: 'string', facet: true  },
          { name: 'age',           type: 'int32',  optional: true },
          { name: 'birth_date',    type: 'string', optional: true },
          { name: 'created_at',    type: 'int64'                },
          { name: 'last_visit_at', type: 'int64',  optional: true },
          { name: 'total_visits',  type: 'int32'                },
        ],
        default_sorting_field: 'created_at',
      });
      logger.info('Typesense patients collection created');
    } catch (err) {
      logger.error({ err }, 'Failed to create Typesense patients collection');
    }
  }
}

export async function upsertPatientDocument(doc: PatientDocument): Promise<void> {
  await typesenseClient.collections(PATIENT_COLLECTION).documents().upsert(doc);
}

export async function deletePatientDocument(id: string): Promise<void> {
  try {
    await typesenseClient.collections(PATIENT_COLLECTION).documents(id).delete();
  } catch {
    // Silently ignore — patient may never have been indexed
  }
}

export interface TypesenseSearchResult {
  hits:  Array<{ document: { id: string } }>;
  found: number;
}

/* ── Coleção de produtos DermSupply ─────────────────────────────────────── */

const PRODUCT_COLLECTION = 'supply_products';

export interface ProductDocument {
  id:            string;
  clinic_id:     string;
  name:          string;
  sku:           string;
  barcode:       string;
  brand:         string;
  category_name: string;
  is_active:     boolean;
  created_at:    number;
}

export async function ensureProductCollection(): Promise<void> {
  try {
    await typesenseClient.collections(PRODUCT_COLLECTION).retrieve();
  } catch {
    try {
      await typesenseClient.collections().create({
        name: PRODUCT_COLLECTION,
        fields: [
          { name: 'clinic_id',     type: 'string', facet: true  },
          { name: 'name',          type: 'string'               },
          { name: 'sku',           type: 'string'               },
          { name: 'barcode',       type: 'string', optional: true },
          { name: 'brand',         type: 'string', optional: true },
          { name: 'category_name', type: 'string', optional: true },
          { name: 'is_active',     type: 'bool',   facet: true  },
          { name: 'created_at',    type: 'int64'                },
        ],
        default_sorting_field: 'created_at',
      });
      logger.info('Typesense supply_products collection created');
    } catch (err) {
      logger.error({ err }, 'Failed to create Typesense supply_products collection');
    }
  }
}

export async function upsertProductDocument(doc: ProductDocument): Promise<void> {
  try {
    await typesenseClient.collections(PRODUCT_COLLECTION).documents().upsert(doc);
  } catch (err) {
    logger.warn({ err, productId: doc.id }, 'Failed to upsert product to Typesense');
  }
}

export async function deleteProductDocument(id: string): Promise<void> {
  try {
    await typesenseClient.collections(PRODUCT_COLLECTION).documents(id).delete();
  } catch {
    // Silently ignore — product may not have been indexed
  }
}

export async function searchProductsInTypesense(
  query:    string,
  clinicId: string,
  page:     number,
  perPage:  number,
): Promise<TypesenseSearchResult> {
  const result = await typesenseClient
    .collections(PRODUCT_COLLECTION)
    .documents()
    .search({
      q:          query,
      query_by:   'name,sku,barcode,brand',
      filter_by:  `clinic_id:=${clinicId} && is_active:=true`,
      page,
      per_page:   perPage,
      prefix:     true,
      num_typos:  1,
    });

  return {
    hits:  (result.hits ?? []) as Array<{ document: { id: string } }>,
    found: result.found ?? 0,
  };
}

export async function searchPatientsInTypesense(
  query:    string,
  clinicId: string,
  page:     number,
  perPage:  number,
): Promise<TypesenseSearchResult> {
  const result = await typesenseClient
    .collections(PATIENT_COLLECTION)
    .documents()
    .search({
      q:             query,
      query_by:      'name,name_search,phone',
      filter_by:     `clinic_id:=${clinicId}`,
      page,
      per_page:      perPage,
      sort_by:       'name_search:asc',
      prefix:        true,
      num_typos:     1,
    });

  return {
    hits:  (result.hits ?? []) as Array<{ document: { id: string } }>,
    found: result.found ?? 0,
  };
}

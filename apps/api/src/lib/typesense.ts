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

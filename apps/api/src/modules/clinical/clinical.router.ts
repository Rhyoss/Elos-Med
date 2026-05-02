import { router } from '../../trpc/trpc.js';
import { encountersRouter }    from './encounters/encounters.router.js';
import { lesionsRouter }       from './lesions/lesions.router.js';
import { prescriptionsRouter } from './prescriptions/prescriptions.router.js';
import { protocolsRouter }     from './protocols/protocols.router.js';
import { documentsRouter }     from './documents/documents.router.js';

export const clinicalRouter = router({
  encounters:    encountersRouter,
  lesions:       lesionsRouter,
  prescriptions: prescriptionsRouter,
  protocols:     protocolsRouter,
  documents:     documentsRouter,
});

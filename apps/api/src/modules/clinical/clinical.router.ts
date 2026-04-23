import { router } from '../../trpc/trpc.js';
import { encountersRouter } from './encounters/encounters.router.js';

export const clinicalRouter = router({
  encounters: encountersRouter,
});

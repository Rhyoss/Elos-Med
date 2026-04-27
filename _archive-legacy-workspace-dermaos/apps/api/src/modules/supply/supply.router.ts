import { router } from '../../trpc/trpc.js';
import { categoriesRouter }       from './categories.router.js';
import { suppliersRouter }        from './suppliers.router.js';
import { storageLocationsRouter } from './storage-locations.router.js';
import { productsRouter }         from './products.router.js';
import { stockRouter }            from './stock.router.js';
import { lotsRouter }             from './lots.router.js';
import { movementsRouter }        from './movements.router.js';
import { purchaseOrdersRouter }   from './purchase-orders.router.js';
import { kitsRouter }             from './kits.router.js';
import { consumptionRouter }      from './consumption.router.js';
import { traceabilityRouter }     from './traceability.router.js';

export const supplyRouter = router({
  categories:       categoriesRouter,
  suppliers:        suppliersRouter,
  storageLocations: storageLocationsRouter,
  products:         productsRouter,
  stock:            stockRouter,
  lots:             lotsRouter,
  movements:        movementsRouter,
  purchaseOrders:   purchaseOrdersRouter,
  kits:             kitsRouter,
  consumption:      consumptionRouter,
  traceability:     traceabilityRouter,
});

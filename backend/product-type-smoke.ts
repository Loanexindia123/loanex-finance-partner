import {
  DEFAULT_PRODUCT_TYPES,
  ensureDefaultProductTypes,
  productTypeService,
} from './src/modules/admin/product-type/product-type.service';
import { jsonDb } from './src/config/json-db';

async function main() {
  await jsonDb.ready;
  await ensureDefaultProductTypes();

  const list1 = await productTypeService.list();
  const names = list1.map((r) => r.name).sort();
  const expected = [...DEFAULT_PRODUCT_TYPES].sort();
  console.log('TEST_SEED_NAMES=' + names.join(','));
  console.log(
    'TEST_SEED_PASS=' +
      String(expected.every((n) => names.some((x) => x.toLowerCase() === n.toLowerCase()))),
  );

  // Idempotent seed
  await ensureDefaultProductTypes();
  const list2 = await productTypeService.list();
  const smartphoneCount = list2.filter((r) => r.name.toLowerCase() === 'smartphone').length;
  console.log('TEST_NO_DUP_SEED=' + smartphoneCount + ' pass=' + (smartphoneCount === 1));

  // Create Gaming Chair
  let createdName = '';
  try {
    const created = await productTypeService.create({ name: 'Gaming Chair' });
    createdName = created.name;
    console.log('TEST_CREATE=' + created.name + ' pass=' + (created.name === 'Gaming Chair'));
  } catch (e: any) {
    // May already exist from prior run
    if (String(e?.message || '').includes('already exists')) {
      createdName = 'Gaming Chair';
      console.log('TEST_CREATE=Gaming Chair (already existed) pass=true');
    } else {
      console.log('TEST_CREATE_FAIL=' + e?.message);
      throw e;
    }
  }

  const active = await productTypeService.listActive();
  console.log(
    'TEST_ACTIVE_HAS_CHAIR=' +
      String(active.some((r) => r.name === 'Gaming Chair')) +
      ' pass=' +
      String(active.some((r) => r.name === 'Gaming Chair')),
  );

  // Duplicate reject
  let dupRejected = false;
  try {
    await productTypeService.create({ name: 'gaming chair' });
  } catch (e: any) {
    dupRejected = String(e?.message || '').toLowerCase().includes('already exists');
    console.log('TEST_DUP_MSG=' + e?.message);
  }
  console.log('TEST_DUP_PASS=' + dupRejected);

  // Deactivate then verify not in active list
  const chair = (await productTypeService.list()).find((r) => r.name === 'Gaming Chair');
  if (chair) {
    await productTypeService.update(chair.id, { status: 'inactive' });
    const activeAfter = await productTypeService.listActive();
    const stillActive = activeAfter.some((r) => r.id === chair.id);
    console.log('TEST_DEACTIVATE_PASS=' + (!stillActive));
    // Reactivate for cleanliness
    await productTypeService.update(chair.id, { status: 'active' });
  }

  console.log('DONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

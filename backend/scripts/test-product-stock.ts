import {
  parseNonNegativeInt,
  resolveProductStockForWrite,
} from '../src/modules/product/utils/product-stock';

function assert(cond: boolean, message: string) {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

assert(parseNonNegativeInt(10).ok === true && (parseNonNegativeInt(10) as any).value === 10, 'Stock = 10 valid');
assert(parseNonNegativeInt(1).ok === true, 'Stock = 1 valid');
assert(parseNonNegativeInt(0).ok === true && (parseNonNegativeInt(0) as any).value === 0, 'Stock = 0 valid');
assert(parseNonNegativeInt(-1).ok === false, 'Stock = -1 invalid');
assert(parseNonNegativeInt(1.5).ok === false, 'Stock = 1.5 invalid');
assert(parseNonNegativeInt('1.5').ok === false, 'Stock = "1.5" invalid');
assert(parseNonNegativeInt('').ok === false && (parseNonNegativeInt('') as any).reason === 'missing', 'empty missing');
assert(parseNonNegativeInt(undefined).ok === false && (parseNonNegativeInt(undefined) as any).reason === 'missing', 'undefined missing');

const createMissing = resolveProductStockForWrite({ name: 'x' }, 'create');
assert(createMissing.ok === false, 'create without stock rejected');

const createZero = resolveProductStockForWrite({ availableStock: 0 }, 'create');
assert(createZero.ok === true && createZero.applied === true && createZero.stock === 0, 'create stock 0 accepted');

const createTen = resolveProductStockForWrite({ wizardData: { availableStock: '10' } }, 'create');
assert(createTen.ok === true && createTen.applied === true && createTen.stock === 10, 'create availableStock 10');

const createDecimal = resolveProductStockForWrite({ stock: 1.5 }, 'create');
assert(createDecimal.ok === false, 'create decimal rejected');

const updateMissing = resolveProductStockForWrite({ status: 'active' }, 'update');
assert(updateMissing.ok === true && updateMissing.applied === false, 'update without stock does not apply');

const variants = resolveProductStockForWrite(
  {
    wizardData: {
      variants: [
        { name: 'Red', stock: '3' },
        { name: 'Blue', stock: 2 },
      ],
    },
  },
  'create',
);
assert(variants.ok === true && variants.applied === true && variants.stock === 5, 'variant stock sum = 5');

const missingVariant = resolveProductStockForWrite(
  { wizardData: { variants: [{ name: 'Red', stock: '' }] } },
  'create',
);
assert(missingVariant.ok === false, 'missing variant stock rejected');

if (process.exitCode) {
  console.error('product-stock tests failed');
  process.exit(1);
}
console.log('product-stock tests passed');

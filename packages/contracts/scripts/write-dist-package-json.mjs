// Marks the output directories with the right module system so that Node and
// bundlers alike pick the correct build (dual CJS/ESM package).
import { writeFileSync, mkdirSync } from 'node:fs';

for (const [dir, type] of [
  ['dist/cjs', 'commonjs'],
  ['dist/esm', 'module'],
]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/package.json`,
    JSON.stringify({ type }, null, 2) + '\n',
  );
}

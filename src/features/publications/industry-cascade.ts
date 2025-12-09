/**
 * Industry filter cascading selection logic
 *
 * @deprecated Use initHierarchyCascade from hierarchy-cascade.ts instead
 * This file is kept for backward compatibility.
 */

import { initHierarchyCascade } from './hierarchy-cascade';

export function initIndustryCascade(): void {
  initHierarchyCascade('industry');
}

export default initIndustryCascade;

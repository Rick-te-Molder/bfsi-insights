'use client';

import { useState } from 'react';

export function useStatusGridExpansion(initialExpanded: string[]) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialExpanded));

  const toggle = (c: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  return { expanded, toggle };
}

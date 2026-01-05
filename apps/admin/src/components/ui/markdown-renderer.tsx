'use client';

import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Readonly<MarkdownRendererProps>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render plain text on server, markdown on client to avoid hydration mismatch
  if (!mounted) {
    return <div className={className}>{content}</div>;
  }

  return (
    <div className={className}>
      <Markdown>{content}</Markdown>
    </div>
  );
}

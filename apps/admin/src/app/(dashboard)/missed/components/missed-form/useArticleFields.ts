import { useState } from 'react';

export function useArticleFields() {
  const [url, setUrl] = useState('');
  return { url, setUrl };
}

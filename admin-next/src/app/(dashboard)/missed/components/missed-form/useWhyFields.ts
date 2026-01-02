import { useState } from 'react';

export function useWhyFields() {
  const [whyValuable, setWhyValuable] = useState('');
  const [verbatimComment, setVerbatimComment] = useState('');

  return {
    whyValuable,
    setWhyValuable,
    verbatimComment,
    setVerbatimComment,
  };
}

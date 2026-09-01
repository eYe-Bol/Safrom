'use client';

import { forwardRef, useCallback, InputHTMLAttributes } from 'react';
import { toProperCase, toSentenceCase, normaliseWhitespace } from '@/utils/text';

type Mode = 'proper' | 'sentence' | 'none';

interface ProperCaseInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  /** 'proper' (default) = Title Case every word
   *  'sentence' = Capitalise first letter only
   *  'none' = no transformation (use for emails, passwords, URLs)
   */
  mode?: Mode;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Drop-in replacement for <input> that automatically normalises text
 * to Proper Case (or Sentence case) when the user finishes typing (onBlur).
 *
 * Usage:
 *   <ProperCaseInput value={name} onChange={setName} placeholder="Store name" className="..." />
 */
const ProperCaseInput = forwardRef<HTMLInputElement, ProperCaseInputProps>(
  ({ mode = 'proper', value, onChange, onBlur, ...rest }, ref) => {

    const normalise = useCallback((raw: string): string => {
      if (mode === 'proper')   return toProperCase(raw);
      if (mode === 'sentence') return toSentenceCase(raw);
      return normaliseWhitespace(raw);
    }, [mode]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const normalised = normalise(e.target.value);
      if (normalised !== e.target.value) {
        onChange(normalised);
      }
      onBlur?.(e);
    };

    return (
      <input
        ref={ref}
        {...rest}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  }
);

ProperCaseInput.displayName = 'ProperCaseInput';
export default ProperCaseInput;

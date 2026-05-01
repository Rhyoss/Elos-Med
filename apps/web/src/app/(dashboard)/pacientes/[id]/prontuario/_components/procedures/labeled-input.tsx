'use client';

import * as React from 'react';
import { Input, T, type InputProps } from '@dermaos/ui/ds';

interface LabeledInputProps extends InputProps {
  label: string;
}

export const LabeledInput = React.forwardRef<HTMLInputElement, LabeledInputProps>(
  function LabeledInput({ label, ...rest }, ref) {
    return (
      <div>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 500,
          color: T.textSecondary,
          marginBottom: 6,
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}>
          {label}
        </label>
        <Input ref={ref} {...rest} />
      </div>
    );
  },
);

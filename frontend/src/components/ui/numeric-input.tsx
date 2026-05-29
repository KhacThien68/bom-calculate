import { forwardRef, useEffect, useState } from 'react';
import { Input } from './input';

export type NumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'inputMode'
>;

const NUMERIC_PATTERN = /^\d*\.?\d*$/;

const toText = (v: unknown): string =>
  v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))
    ? ''
    : String(v);

export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, onFocus, onBlur, ...rest }, ref) => {
    const isControlled = value !== undefined;
    const externalText = toText(value);
    const [internal, setInternal] = useState(externalText);
    const [focused, setFocused] = useState(false);

    // Sync external value into local state only when input is not focused,
    // so typing (including clearing "0") is not disrupted.
    useEffect(() => {
      if (!isControlled || focused) return;
      setInternal(externalText);
    }, [externalText, isControlled, focused]);

    const handleBeforeInput: React.FormEventHandler<HTMLInputElement> = (e) => {
      const data = (e.nativeEvent as InputEvent).data;
      if (data == null) return;
      const target = e.currentTarget;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const next = target.value.slice(0, start) + data + target.value.slice(end);
      if (!NUMERIC_PATTERN.test(next)) e.preventDefault();
    };

    return (
      <Input
        ref={ref}
        {...rest}
        type="text"
        inputMode="decimal"
        value={isControlled ? internal : undefined}
        onChange={(e) => {
          if (isControlled) setInternal(e.target.value);
          onChange?.(e);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        onBeforeInput={handleBeforeInput}
      />
    );
  }
);
NumericInput.displayName = 'NumericInput';

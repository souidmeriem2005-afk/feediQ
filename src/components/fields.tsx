import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldChrome {
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

type TextFieldProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange' | 'className'> & {
    value: string;
    onChange: (value: string) => void;
    suffix?: string;
  };

export function TextField({ label, hint, error, required, className, value, onChange, suffix, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <input
          id={id}
          className={`input ${error ? 'input-invalid' : ''} ${suffix ? 'pl-14' : ''}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

type NumberFieldProps = TextFieldProps & {
  step?: string | number;
  min?: number;
  max?: number;
};

export function NumberField({ label, hint, error, required, className, value, onChange, suffix, ...rest }: NumberFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          dir="ltr"
          className={`input text-right tnum ${error ? 'input-invalid' : ''} ${suffix ? 'pl-16' : ''}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectFieldProps = FieldChrome &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange' | 'className' | 'children'> & {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
  };

export function SelectField({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        className={`input ${error ? 'input-invalid' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = FieldChrome &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'value' | 'onChange' | 'className'> & {
    value: string;
    onChange: (value: string) => void;
  };

export function TextAreaField({
  label,
  hint,
  error,
  required,
  className,
  value,
  onChange,
  ...rest
}: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        id={id}
        className={`input min-h-24 ${error ? 'input-invalid' : ''}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-sand-400 accent-brand-700"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-semibold text-slate-700">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
}

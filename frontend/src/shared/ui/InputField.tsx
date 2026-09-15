import { useId, type ComponentPropsWithRef } from 'react';

interface InputFieldProps extends ComponentPropsWithRef<'input'> {
  label?: string;
  error?: string;
}

export function InputField({ label, error, className = '', ...props }: InputFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`min-h-12 w-full rounded-xl border bg-surface px-4 text-base placeholder-gray-400 transition-[border-color] duration-75 focus:outline-none ${
          error ? 'border-status-low' : 'border-gray-200 focus:border-primary'
        }`}
        {...props}
      />
      {error && <p className="mt-1.5 text-sm text-status-low">{error}</p>}
    </div>
  );
}

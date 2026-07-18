import { type HTMLAttributes, type ReactNode } from 'react';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  label: ReactNode;
  labelFor?: string;
  required?: boolean;
};

export function Field({
  children,
  className = '',
  description,
  error,
  label,
  labelFor,
  required,
  ...props
}: FieldProps) {
  return (
    <div className={`ui-field${error ? ' ui-field--error' : ''}${className ? ` ${className}` : ''}`} {...props}>
      <label className="ui-field__label" htmlFor={labelFor}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </label>
      {children}
      {description ? <small className="ui-field__description">{description}</small> : null}
      {error ? (
        <small className="ui-field__error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}

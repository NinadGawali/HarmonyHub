import React, { forwardRef, useId } from 'react';
import styles from './Field.module.css';

const cx = (...classes) => classes.filter(Boolean).join(' ');

function FieldShell({ id, label, hint, error, hideLabel, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={cx(styles.label, hideLabel && 'visually-hidden')}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className={styles.error} role="alert">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

// Text input with label, optional leading icon, hint and error.
export const TextInput = forwardRef(function TextInput(
  { label, hint, error, hideLabel = false, icon: Icon, trailing, className, id: idProp, ...rest },
  ref
) {
  const generatedId = useId();
  const id = idProp || generatedId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div className={cx(styles.control, error && styles.invalid, className)}>
        {Icon && <Icon size={18} className={styles.icon} aria-hidden="true" />}
        <input
          ref={ref}
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...rest}
        />
        {trailing}
      </div>
    </FieldShell>
  );
});

export const TextArea = forwardRef(function TextArea(
  { label, hint, error, hideLabel = false, className, id: idProp, rows = 3, ...rest },
  ref
) {
  const generatedId = useId();
  const id = idProp || generatedId;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div className={cx(styles.control, styles.multiline, error && styles.invalid, className)}>
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={cx(styles.input, styles.textarea)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...rest}
        />
      </div>
    </FieldShell>
  );
});

import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import styles from './Button.module.css';

const cx = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Button or link styled as a button.
 * variant: primary | secondary | ghost | danger | spotify
 * size: sm | md | lg
 * Pass `to` for an in-app link or `href` for an external one.
 */
const Button = forwardRef(function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  fullWidth = false,
  iconOnly = false,
  to,
  href,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}, ref) {
  const classes = cx(
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    iconOnly && styles.iconOnly,
    className
  );
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18;

  const content = (
    <>
      {loading ? <Spinner size={iconSize} /> : Icon && <Icon size={iconSize} aria-hidden="true" />}
      {children && <span className={styles.label}>{children}</span>}
      {IconRight && !loading && <IconRight size={iconSize} aria-hidden="true" />}
    </>
  );

  if (to) {
    return <Link ref={ref} to={to} className={classes} {...rest}>{content}</Link>;
  }
  if (href) {
    return <a ref={ref} href={href} className={classes} {...rest}>{content}</a>;
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;

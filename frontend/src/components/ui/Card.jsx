import React from 'react';
import styles from './Card.module.css';

const cx = (...classes) => classes.filter(Boolean).join(' ');

// Surface container. `as` changes the element; `padding` is none | sm | md | lg.
export default function Card({ as: Element = 'section', padding = 'md', interactive = false, className, children, ...rest }) {
  return (
    <Element className={cx(styles.card, styles[`pad-${padding}`], interactive && styles.interactive, className)} {...rest}>
      {children}
    </Element>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <header className={styles.header}>
      <div className={styles.headingGroup}>
        {Icon && <span className={styles.icon}><Icon size={18} aria-hidden="true" /></span>}
        <div>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

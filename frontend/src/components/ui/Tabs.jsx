import React, { useId, useRef } from 'react';
import styles from './Tabs.module.css';

/**
 * Accessible tab list. `tabs` is [{ id, label, icon?, badge? }].
 * Render the active panel yourself inside <TabPanel>.
 */
export default function Tabs({ tabs, active, onChange, label, idPrefix }) {
  const generated = useId();
  const prefix = idPrefix || generated;
  const refs = useRef({});

  const focusTab = (index) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  };

  const handleKeyDown = (event, index) => {
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      focusTab(moves[event.key]);
    }
  };

  return (
    <div className={styles.list} role="tablist" aria-label={label}>
      {tabs.map(({ id, label: tabLabel, icon: Icon, badge }, index) => {
        const selected = id === active;
        return (
          <button
            key={id}
            ref={(node) => { refs.current[id] = node; }}
            id={`${prefix}-tab-${id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${prefix}-panel-${id}`}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{tabLabel}</span>
            {badge ? <span className={styles.badge}>{badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, idPrefix, children }) {
  return (
    <div id={`${idPrefix}-panel-${id}`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${id}`}>
      {children}
    </div>
  );
}

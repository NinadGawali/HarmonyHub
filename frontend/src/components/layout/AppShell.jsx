import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, PartyPopper, Sparkles, Library } from 'lucide-react';
import BrandMark from './BrandMark';
import UserMenu from '../UserMenu';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/party', label: 'Party', icon: PartyPopper },
  { to: '/create', label: 'Create', icon: Sparkles },
  { to: '/library', label: 'Library', icon: Library }
];

const navClass = ({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`;
const tabClass = ({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`;

// Layout for the main (non-party) pages: top bar on desktop, bottom tab bar on phones.
export default function AppShell() {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>Skip to content</a>

      <header className={styles.topbar}>
        <div className={`container ${styles.topbarInner}`}>
          <BrandMark />
          <nav className={styles.nav} aria-label="Main">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navClass}>{label}</NavLink>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>

      <main id="main" className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.tabbar} aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={tabClass}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

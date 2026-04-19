import React from 'react';
import { Upload } from 'lucide-react';

export const Header = ({
  status,
  statusLabel,
  t,
  uiText,
  lang,
  setLang,
  handleFileUpload,
  navItems,
  activeTab,
  setActiveTab
}) => {
  return (
    <header className="topbar-surface">
      <div className="topbar-main">
        <div className="brand-lockup">
          <div className="logo">
            <div className="logo-icon">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="anx-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0066FF" />
                    <stop offset="100%" stopColor="#00D4FF" />
                  </linearGradient>
                  <linearGradient id="anx-gradient-2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4D72FF" />
                    <stop offset="100%" stopColor="#7AA6FF" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="16" cy="16" r="13" stroke="url(#anx-gradient-1)" strokeWidth="1.5" fill="none" opacity="0.3"/>
                <path d="M16 6 L24 20 L20 20 L16 12 L12 20 L8 20 Z" fill="url(#anx-gradient-1)" filter="url(#glow)"/>
                <circle cx="16" cy="16" r="2" fill="#FFFFFF" opacity="0.95"/>
                <circle cx="16" cy="16" r="8" stroke="url(#anx-gradient-2)" strokeWidth="1.2" fill="none" opacity="0.4" strokeDasharray="2 3"/>
              </svg>
            </div>
            <div className="logo-copy">
              <span className="logo-title">Anx Showtime</span>
              <div className="logo-badge">
                <span className="logo-badge-dot"></span>
                {uiText.workspace}
              </div>
            </div>
          </div>
        </div>

        <div className="topbar-utilities">
          <div className={`utility-status ${status}`}>
            <div className="status-dot"></div>
            <div className="utility-status-copy">
              <span>{t.backend}</span>
              <strong>{statusLabel}</strong>
            </div>
          </div>

          <label className="utility-upload">
            <Upload size={18} />
            <span>{t.upload}</span>
            <input type="file" hidden onChange={handleFileUpload} />
          </label>

          <div className="lang-toggle utility-lang-toggle">
            <button className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>CN</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>
      </div>

      <div className="topbar-nav-shell">
        <nav className="topbar-nav" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`top-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <NavIcon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

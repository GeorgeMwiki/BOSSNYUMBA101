/**
 * apps/admin-portal — minimal entry point.
 *
 * The portal is deprecated; App.tsx renders only a "moved" landing.
 * No router, no auth, no query client — the page links out to the
 * destination portals (admin-platform-portal and owner-portal). See
 * apps/admin-portal/DEPRECATED.md.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

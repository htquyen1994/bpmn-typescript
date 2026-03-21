export const TAB_BAR_STYLES = `
/* ── Tab bar wrapper ─────────────────────────────────────────────────────── */
.csp-tab-bar {
  display: flex;
  align-items: center;
  background: #efefef;
  border-top: 1px solid #c8c8c8;
  height: 34px;
  flex-shrink: 0;
  padding: 0 6px 0 0;
  overflow: hidden;
}

/* ── Scrollable tab list ─────────────────────────────────────────────────── */
.csp-tab-list {
  display: flex;
  align-items: flex-end;
  flex: 1;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.csp-tab-list::-webkit-scrollbar { display: none; }

/* ── Individual tab ──────────────────────────────────────────────────────── */
.csp-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 6px 0 10px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #e0e0e0;
  color: #666;
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  margin-right: 2px;
  max-width: 180px;
  position: relative;
  bottom: -1px;
  flex-shrink: 0;
  transition: background 0.12s;
}
.csp-tab:hover { background: #e9e9e9; color: #333; }

/* ── Active tab ──────────────────────────────────────────────────────────── */
.csp-tab--active {
  background: #ffffff;
  color: #1a1a1a;
  border-color: #c8c8c8;
  font-weight: 500;
  z-index: 1;
}

/* ── Tab label ───────────────────────────────────────────────────────────── */
.csp-tab-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Dirty dot ───────────────────────────────────────────────────────────── */
.csp-tab-dirty {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
}

/* ── Close button ────────────────────────────────────────────────────────── */
.csp-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #999;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
}
.csp-tab:hover .csp-tab-close,
.csp-tab--active .csp-tab-close { opacity: 1; }
.csp-tab-close:hover { background: #fecaca; color: #b91c1c; }

/* ── Add tab button ──────────────────────────────────────────────────────── */
.csp-tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #666;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  margin-left: 4px;
  transition: background 0.12s, color 0.12s;
}
.csp-tab-add:hover { background: #ddd; color: #333; border-color: #bbb; }
`;

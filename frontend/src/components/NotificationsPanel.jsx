import { useEffect, useRef, useState } from 'react';

const TX_ICON = {
  TRANSFER_IN: '↙',
  TRANSFER_OUT: '↗',
  DEPOSIT: '↙',
  WITHDRAWAL: '↗',
};

function isCredit(type) {
  return type === 'TRANSFER_IN' || type === 'DEPOSIT';
}

function formatMoney(amount) {
  const n = Number(amount);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRelative(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SEEN_KEY = 'ledgerline_seen_tx_refs';

function getSeenRefs() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSeenRefs(refs) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...refs]));
}

/**
 * Self-contained bell icon + dropdown. Reads "unread" state from a small
 * localStorage list of transaction references the user has already seen —
 * a new transaction (from a fresh deposit, transfer, or the background poll
 * in DashboardPage picking one up) shows a red dot until the panel is opened,
 * at which point everything currently visible is marked seen.
 */
export default function NotificationsPanel({ transactions }) {
  const [open, setOpen] = useState(false);
  const [seenRefs, setSeenRefs] = useState(getSeenRefs);
  const panelRef = useRef(null);

  const unreadCount = transactions.filter((tx) => !seenRefs.has(tx.reference)).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        // Opening — mark everything currently loaded as seen so the badge clears.
        const updated = new Set(seenRefs);
        transactions.forEach((tx) => updated.add(tx.reference));
        setSeenRefs(updated);
        saveSeenRefs(updated);
      }
      return next;
    });
  };

  return (
    <div className="notif-wrap" ref={panelRef}>
      <div className="icon-btn" onClick={toggleOpen}>
        🔔
        {unreadCount > 0 && <span className="dot-badge"></span>}
      </div>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <span>Notifications</span>
            {unreadCount === 0 && transactions.length > 0 && (
              <span className="notif-all-caught-up">All caught up</span>
            )}
          </div>

          <div className="notif-list">
            {transactions.length === 0 && (
              <div className="notif-empty">No notifications yet.</div>
            )}
            {transactions.map((tx) => (
              <div className="notif-item" key={tx.reference}>
                <div className={`notif-icon ${isCredit(tx.type) ? 'pos' : 'neg'}`}>
                  {TX_ICON[tx.type] || '•'}
                </div>
                <div className="notif-info">
                  <div className="notif-title">
                    {isCredit(tx.type) ? 'Money received' : 'Money sent'}
                  </div>
                  <div className="notif-desc">{tx.description || tx.type}</div>
                  <div className="notif-time">{formatRelative(tx.createdAt)}</div>
                </div>
                <div className={`notif-amt ${isCredit(tx.type) ? 'pos' : 'neg'}`}>
                  {isCredit(tx.type) ? '+' : '−'}{formatMoney(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
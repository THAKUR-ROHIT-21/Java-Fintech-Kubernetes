import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAccounts, getTransactions, depositMoney, toggleFreeze } from '../services/accountService';
import { getAllAccounts } from '../services/adminService';
import { getCurrentUser, logout } from '../services/authService';
import SendMoneyModal from '../components/SendMoneyModal';
import LedgerView from '../components/LedgerView';
import NotificationsPanel from '../components/NotificationsPanel';
import AccountsView from '../components/AccountsView';

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

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isAdmin = user?.role === 'ADMIN';

  // 'overview' = normal dashboard, 'admin-accounts' = admin's full customer/account table
  const [view, setView] = useState('overview');

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const knownTxRefs = useRef(new Set());
  const toastTimerRef = useRef(null);

  const [allAccounts, setAllAccounts] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminSearch, setAdminSearch] = useState('');

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addMoneyAccountId, setAddMoneyAccountId] = useState('');
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [addMoneyNote, setAddMoneyNote] = useState('');
  const [addMoneyLoading, setAddMoneyLoading] = useState(false);
  const [addMoneyPhase, setAddMoneyPhase] = useState('idle'); // 'idle' | 'submitting' | 'success'
  const [addMoneyError, setAddMoneyError] = useState('');
  const [addMoneySuccess, setAddMoneySuccess] = useState('');
  // useState is async/batched — two rapid clicks can both read the OLD value of
  // addMoneyLoading before the first click's re-render lands, so a state-only
  // guard can let both through. A ref updates immediately, in the same tick,
  // so it's the actual single-flight lock; the state is only for UI (disabling
  // fields, showing the spinner).
  const submittingRef = useRef(false);

  const [showSendMoney, setShowSendMoney] = useState(false);
  const [sendMoneyFromId, setSendMoneyFromId] = useState(null);

  const openSendMoney = (preselectAccountId) => {
    setSendMoneyFromId(preselectAccountId ?? null);
    setShowSendMoney(true);
  };

  async function loadDashboard(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const accs = await getMyAccounts();
      setAccounts(accs);

      const txLists = await Promise.all(
        accs.map((a) => getTransactions(a.id, 0, 10).catch(() => []))
      );

      const merged = txLists.flat().sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      const recent = merged.slice(0, 6);
      setTransactions(recent);

      // Diff against what we already knew about — anything new gets a toast.
      // Skipped on the very first load (knownTxRefs starts empty) so the
      // user isn't greeted with a wall of toasts for old history.
      if (knownTxRefs.current.size > 0) {
        const freshOnes = recent.filter((tx) => !knownTxRefs.current.has(tx.reference));
        if (freshOnes.length > 0) {
          showToast(freshOnes[0]);
        }
      }
      knownTxRefs.current = new Set(merged.map((tx) => tx.reference));

      return accs;
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load your account data.');
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function playNotificationSound() {
    // Synthesized two-note chime via Web Audio API — no audio file to
    // host/load, works instantly. Wrapped in try/catch since some browsers
    // block audio before any user interaction; failing silently is fine here,
    // the toast itself still shows regardless.
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;

      const playTone = (freq, start, duration, peakGain) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(peakGain, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.05);
      };

      // Soft ascending two-note chime — A5 then E6
      playTone(880, 0, 0.18, 0.16);
      playTone(1318.5, 0.09, 0.28, 0.13);

      setTimeout(() => ctx.close(), 600);
    } catch {
      // audio unsupported/blocked — ignore, the visual toast is enough
    }
  }

  function showToast(tx) {
    playNotificationSound();
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(tx);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then(() => {
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (view !== 'admin-accounts' || !isAdmin) return;
    let cancelled = false;

    setAdminLoading(true);
    setAdminError('');
    getAllAccounts()
      .then((data) => { if (!cancelled) setAllAccounts(data); })
      .catch((err) => { if (!cancelled) setAdminError(err.message || 'Could not load accounts.'); })
      .finally(() => { if (!cancelled) setAdminLoading(false); });

    return () => { cancelled = true; };
  }, [view, isAdmin]);

  // Background polling — silently re-checks for new transactions every 5s so
  // the notification bell updates without the user having to refresh or
  // reload the page. Doesn't touch the loading/error UI (silent=true).
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openAddMoney = (preselectAccountId) => {
    submittingRef.current = false;
    setAddMoneyPhase('idle');
    setAddMoneyAccountId(preselectAccountId ?? accounts[0]?.id ?? '');
    setAddMoneyAmount('');
    setAddMoneyNote('');
    setAddMoneyError('');
    setAddMoneySuccess('');
    setShowAddMoney(true);
  };

  const closeAddMoney = () => {
    if (submittingRef.current) return;
    setShowAddMoney(false);
  };

  const handleAddMoneySubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return; // real guard — checked and set synchronously, no race
    setAddMoneyError('');

    const amountNum = Number(addMoneyAmount);
    if (!addMoneyAccountId) {
      setAddMoneyError('Choose an account.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setAddMoneyError('Enter an amount greater than zero.');
      return;
    }

    submittingRef.current = true;
    setAddMoneyLoading(true);
    setAddMoneyPhase('submitting');
    try {
      const idempotencyKey = `deposit-${addMoneyAccountId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await depositMoney(addMoneyAccountId, {
        amount: amountNum,
        description: addMoneyNote || 'Added money',
        idempotencyKey,
      });
      setAddMoneySuccess(`₹${amountNum.toLocaleString('en-IN')} added successfully.`);
      await loadDashboard();
      setAddMoneyPhase('success');
      // Keep the loader/lock ACTIVE for this whole delay — the form should stay
      // blocked right up until the modal actually disappears, not the moment
      // the network request finishes.
      setTimeout(() => {
        setShowAddMoney(false);
        setAddMoneyLoading(false);
        setAddMoneyPhase('idle');
        submittingRef.current = false;
      }, 1200);
    } catch (err) {
      setAddMoneyError(err.message || 'Could not add money. Please try again.');
      submittingRef.current = false;
      setAddMoneyLoading(false);
      setAddMoneyPhase('idle');
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const savings = accounts.find((a) => a.type === 'SAVINGS');
  const current = accounts.find((a) => a.type === 'CURRENT');

  const initials = (user?.fullName || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const firstName = (user?.fullName || 'there').split(' ')[0];

  const filteredAdminAccounts = allAccounts.filter((a) => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      a.customerName?.toLowerCase().includes(q) ||
      a.customerEmail?.toLowerCase().includes(q) ||
      a.accountNumber?.includes(q)
    );
  });

  const bankWideTotal = allAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 12h16M4 6h10M4 18h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          Ledgerline
        </div>

        <div className="side-section-label">MENU</div>
        <div className="side-nav">
          <div
            className={`side-item ${view === 'overview' ? 'active' : ''}`}
            onClick={() => setView('overview')}
          >
            <span className="ic">◆</span> Overview
          </div>
          <div className="side-item" onClick={() => openSendMoney()}><span className="ic">⇄</span> Transfers</div>
          <div
            className={`side-item ${view === 'transactions' ? 'active' : ''}`}
            onClick={() => setView('transactions')}
          >
            <span className="ic">▤</span> Ledger
          </div>
          <div
            className={`side-item ${view === 'accounts' ? 'active' : ''}`}
            onClick={() => setView('accounts')}
          >
            <span className="ic">◐</span> Accounts & Cards
          </div>
          
          <div className="side-item"><span className="ic">✎</span> Audit log</div>
        </div>

        {isAdmin && (
          <>
            <div className="side-section-label">ADMIN</div>
            <div className="side-nav">
              <div
                className={`side-item ${view === 'admin-accounts' ? 'active' : ''}`}
                onClick={() => setView('admin-accounts')}
              >
                <span className="ic">🛡</span> All accounts <span className="badge">{allAccounts.length || ''}</span>
              </div>
            </div>
          </>
        )}

        <div className="side-section-label">SUPPORT</div>
        <div className="side-nav">
          <div className="side-item"><span className="ic">⚙</span> Settings</div>
          <div className="side-item" onClick={handleLogout}><span className="ic">⏻</span> Log out</div>
        </div>

        <div className="side-bottom">
          <div className="side-user">
            <div className="side-avatar">{initials}</div>
            <div>
              <div className="side-user-name">
                {user?.fullName || 'Account'}
                {isAdmin && <span className="admin-tag">ADMIN</span>}
              </div>
              <div className="side-user-email">{user?.email || ''}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        {view === 'overview' && (
          <>
            <div className="topbar">
              <div className="greeting">
                <h1>Good morning, {firstName} 👋</h1>
                <p>Here's what's happening with your money today.</p>
              </div>
              <div className="topbar-right">
                <div className="search-box" style={{ cursor: 'pointer' }} onClick={() => setView('transactions')}>
                  🔍 Search transactions...
                </div>
                <NotificationsPanel transactions={transactions} />
                <div className="icon-btn">⚙</div>
                <button className="btn-primary-sm" onClick={() => openSendMoney()}>+ New transfer</button>
              </div>
            </div>

            {loading && <div className="card" style={{ padding: 24 }}>Loading your accounts…</div>}
            {error && !loading && (
              <div className="card" style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>
            )}

            {!loading && !error && (
              <>
                <div className="metric-row">
                  <div className="card balance-card">
                    <div className="balance-top">
                      <span className="balance-label">TOTAL BALANCE</span>
                      <span className="balance-eye">👁 Hide</span>
                    </div>
                    <div className="balance-val">{formatMoney(totalBalance)}</div>
                    <div className="balance-accounts">
                      {savings && (
                        <div className="acc-chip">
                          <span className="sw" style={{ background: 'var(--accent)' }}></span>
                          Savings · {formatMoney(savings.balance)}
                        </div>
                      )}
                      {current && (
                        <div className="acc-chip">
                          <span className="sw" style={{ background: 'var(--mint)' }}></span>
                          Current · {formatMoney(current.balance)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card mini-metric">
                    <div className="mini-metric-label">ACCOUNTS</div>
                    <div className="mini-metric-val">{accounts.length}</div>
                    <div className="mini-metric-trend" style={{ color: 'var(--ink-faint)' }}>
                      {accounts.map((a) => a.type).join(' · ') || 'No accounts yet'}
                    </div>
                  </div>

                  <div className="card mini-metric">
                    <div className="mini-metric-label">RECENT ACTIVITY</div>
                    <div className="mini-metric-val">{transactions.length}</div>
                    <div className="mini-metric-trend" style={{ color: 'var(--ink-faint)' }}>
                      transactions in the last few days
                    </div>
                  </div>
                </div>

                <div className="quick-actions">
                  <div className="card qa-card" onClick={() => openSendMoney()}>
                    <div className="qa-icon blue">⇄</div>
                    <div><div className="qa-title">Send money</div><div className="qa-sub">To anyone, instantly</div></div>
                  </div>
                  <div className="card qa-card" onClick={openAddMoney}>
                    <div className="qa-icon mint">↓</div>
                    <div><div className="qa-title">Add money</div><div className="qa-sub">From a linked bank</div></div>
                  </div>
                  <div className="card qa-card">
                    <div className="qa-icon amber">▤</div>
                    <div><div className="qa-title">Pay a bill</div><div className="qa-sub">Electricity, rent & more</div></div>
                  </div>
                  <div className="card qa-card" onClick={() => setView('accounts')}>
                    <div className="qa-icon slate">⏻</div>
                    <div><div className="qa-title">Freeze card</div><div className="qa-sub">Lock instantly</div></div>
                  </div>
                </div>

                <div className="bottom-row">
                  <div className="card accounts-card">
                    <h3 style={{ fontFamily: "'Manrope',sans-serif", fontSize: 15.5, fontWeight: 700 }}>Your accounts</h3>
                    <div className="acc-list">
                      {accounts.map((a) => (
                        <div className="acc-row" key={a.id} onClick={() => setView('accounts')}>
                          <div className={`acc-icon ${a.type === 'SAVINGS' ? 'sav' : 'cur'}`}>
                            {a.type === 'SAVINGS' ? '◈' : '▤'}
                          </div>
                          <div>
                            <div className="acc-name">
                              {a.type === 'SAVINGS' ? 'Savings account' : 'Current account'}
                            </div>
                            <div className="acc-num">•••• {a.accountNumber.slice(-4)}</div>
                          </div>
                          <div className="acc-bal">{formatMoney(a.balance)}</div>
                        </div>
                      ))}
                      {accounts.length === 0 && (
                        <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '12px 4px' }}>
                          No accounts yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card tx-card">
                    <div className="tx-head">
                      <h3>Recent transactions</h3>
                      <span className="tx-see-all" onClick={() => setView('transactions')}>See all →</span>
                    </div>
                    {transactions.map((tx) => (
                      <div className="tx-row" key={tx.reference}>
                        <div className="tx-icon">{TX_ICON[tx.type] || '•'}</div>
                        <div className="tx-info">
                          <div className="tx-name">{tx.description || tx.type}</div>
                          <div className="tx-meta">{tx.reference} · {formatDate(tx.createdAt)}</div>
                        </div>
                        <span className={`tx-status ${tx.status === 'COMPLETED' ? 'done' : 'pending'}`}>
                          {tx.status === 'COMPLETED' ? 'Completed' : 'Processing'}
                        </span>
                        <div className={`tx-amt ${isCredit(tx.type) ? 'pos' : 'neg'}`}>
                          {isCredit(tx.type) ? '+' : '−'}{formatMoney(tx.amount)}
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '12px 4px' }}>
                        No transactions yet.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {view === 'transactions' && <LedgerView accounts={accounts} />}

        {view === 'accounts' && (
          <AccountsView
            accounts={accounts}
            onViewLedger={() => setView('transactions')}
            onAccountAdded={loadDashboard}
            onSendMoney={(accountId) => openSendMoney(accountId)}
            onAddMoney={(accountId) => openAddMoney(accountId)}
            onToggleFreeze={async (accountId) => {
              await toggleFreeze(accountId);
              await loadDashboard();
            }}
          />
        )}

        {view === 'admin-accounts' && isAdmin && (
          <>
            <div className="topbar">
              <div className="greeting">
                <h1>All accounts <span className="admin-tag" style={{ marginLeft: 10 }}>ADMIN</span></h1>
                <p>Every customer account across the bank, in one place.</p>
              </div>
              <div className="topbar-right">
                <input
                  className="search-box"
                  style={{ border: '1px solid var(--line)', outline: 'none' }}
                  placeholder="Search name, email, account number..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="metric-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="card mini-metric">
                <div className="mini-metric-label">TOTAL ACCOUNTS</div>
                <div className="mini-metric-val">{allAccounts.length}</div>
              </div>
              <div className="card mini-metric">
                <div className="mini-metric-label">UNIQUE CUSTOMERS</div>
                <div className="mini-metric-val">
                  {new Set(allAccounts.map((a) => a.customerId)).size}
                </div>
              </div>
              <div className="card mini-metric">
                <div className="mini-metric-label">BANK-WIDE BALANCE</div>
                <div className="mini-metric-val">{formatMoney(bankWideTotal)}</div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {adminLoading && <div style={{ padding: 24 }}>Loading all accounts…</div>}
              {adminError && !adminLoading && (
                <div style={{ padding: 24, color: 'var(--danger)' }}>{adminError}</div>
              )}
              {!adminLoading && !adminError && (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdminAccounts.map((a) => (
                      <tr key={a.accountId}>
                        <td>
                          <div className="admin-cell-name">{a.customerName}</div>
                          <div className="admin-cell-sub">Customer #{a.customerId}</div>
                        </td>
                        <td>
                          <div className="admin-cell-name">{a.customerEmail}</div>
                          <div className="admin-cell-sub">{a.customerPhone || '—'}</div>
                        </td>
                        <td className="mono" style={{ color: 'var(--ink)', fontWeight: 500 }}>{a.accountNumber}</td>
                        <td>
                          <span className={`admin-badge ${a.type === 'SAVINGS' ? 'blue' : 'mint'}`}>
                            {a.type}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge ${a.status === 'ACTIVE' ? 'mint' : 'amber'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: "'Manrope',sans-serif" }}>
                          {formatMoney(a.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!adminLoading && !adminError && filteredAdminAccounts.length === 0 && (
                <div style={{ padding: 24, color: 'var(--ink-faint)', fontSize: 13.5 }}>
                  No accounts match your search.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className="toast-popup" onClick={() => setToast(null)}>
          <div className={`toast-icon ${isCredit(toast.type) ? 'pos' : 'neg'}`}>
            {TX_ICON[toast.type] || '•'}
          </div>
          <div className="toast-body">
            <div className="toast-title">{isCredit(toast.type) ? 'Money received' : 'Money sent'}</div>
            <div className="toast-desc">{toast.description || toast.type}</div>
          </div>
          <div className={`toast-amt ${isCredit(toast.type) ? 'pos' : 'neg'}`}>
            {isCredit(toast.type) ? '+' : '−'}{formatMoney(toast.amount)}
          </div>
        </div>
      )}

      {showSendMoney && (
        <SendMoneyModal
          accounts={accounts}
          initialFromAccountId={sendMoneyFromId}
          onClose={() => setShowSendMoney(false)}
          onSuccess={loadDashboard}
        />
      )}

      {showAddMoney && (
        <div className="modal-overlay" onClick={closeAddMoney}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Add money</h3>
              <button className="modal-close" onClick={closeAddMoney} disabled={addMoneyLoading}>✕</button>
            </div>
            <p className="modal-sub">Simulates a deposit from a linked bank account.</p>

            <div className="modal-form-shell">
              <form onSubmit={handleAddMoneySubmit}>
                <div className="field">
                  <label htmlFor="addMoneyAccount">To account</label>
                  <div className="input-wrap">
                    <select
                      id="addMoneyAccount"
                      value={addMoneyAccountId}
                      onChange={(e) => setAddMoneyAccountId(e.target.value)}
                      disabled={addMoneyLoading}
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.type === 'SAVINGS' ? 'Savings' : 'Current'} · •••• {a.accountNumber.slice(-4)} · {formatMoney(a.balance)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="addMoneyAmount">Amount (₹)</label>
                  <div className="input-wrap">
                    <input
                      type="number"
                      id="addMoneyAmount"
                      min="1"
                      step="0.01"
                      placeholder="e.g. 5000"
                      value={addMoneyAmount}
                      onChange={(e) => setAddMoneyAmount(e.target.value)}
                      disabled={addMoneyLoading}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="addMoneyNote">Note (optional)</label>
                  <div className="input-wrap">
                    <input
                      type="text"
                      id="addMoneyNote"
                      placeholder="e.g. From HDFC savings"
                      value={addMoneyNote}
                      onChange={(e) => setAddMoneyNote(e.target.value)}
                      disabled={addMoneyLoading}
                    />
                  </div>
                </div>

                {addMoneyError && <div className="form-error">{addMoneyError}</div>}

                <button type="submit" className="btn-submit" disabled={addMoneyLoading}>
                  {addMoneyLoading ? 'Adding…' : 'Add money'}
                </button>
              </form>

              {/* Full-form blocking overlay — fades in the instant submitting starts,
                  covers every field + the submit button, and eats all clicks
                  (pointer-events set via CSS) so nothing underneath is reachable
                  until the modal actually closes. Switches from spinner to a
                  checkmark once the deposit succeeds, instead of just vanishing
                  and exposing the plain form again. */}
              <div className={`modal-loading-overlay ${addMoneyPhase !== 'idle' ? 'visible' : ''}`}>
                {addMoneyPhase === 'success' ? (
                  <>
                    <div className="modal-success-tick">✓</div>
                    <span>{addMoneySuccess}</span>
                  </>
                ) : (
                  <>
                    <div className="modal-spinner"></div>
                    <span>Adding money…</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
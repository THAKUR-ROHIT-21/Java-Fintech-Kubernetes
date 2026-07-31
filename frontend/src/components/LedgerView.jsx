import { useEffect, useMemo, useState } from 'react';
import { getTransactions } from '../services/accountService';

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

const DATE_PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
];

function withinPreset(dateIso, presetKey) {
  if (presetKey === 'all') return true;
  const d = new Date(dateIso);
  const now = new Date();

  if (presetKey === '7d') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    return d >= cutoff;
  }
  if (presetKey === '30d') {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    return d >= cutoff;
  }
  if (presetKey === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  return true;
}

/**
 * Full transaction ledger for the current user, across all their accounts.
 * Owns its own fetch + filter state — DashboardPage just renders this when
 * the "Ledger" view is active and passes the account list.
 */
export default function LedgerView({ accounts }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [datePreset, setDatePreset] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Depend on the account IDs joined into a string, not the `accounts` array
  // itself — DashboardPage's background polling calls setAccounts() every 5s
  // with a brand-new array (even when the underlying data is identical), and
  // an array is a new reference every time. Using the array directly as a
  // dependency would re-trigger this whole fetch (and the loading flash that
  // comes with it) on every single poll. The ID string only changes when the
  // account list actually changes.
  const accountIdsKey = accounts.map((a) => a.id).join(',');

  useEffect(() => {
    if (accounts.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    setLoading(true);
    setError('');
    Promise.all(accounts.map((a) => getTransactions(a.id, 0, 100).catch(() => [])))
      .then((lists) => {
        if (cancelled) return;
        // tag each transaction with which of the user's accounts it belongs to,
        // so the account filter can work without another round trip
        const tagged = lists.flatMap((list, i) =>
          list.map((tx) => ({ ...tx, _accountId: accounts[i].id, _accountLabel: `${accounts[i].type === 'SAVINGS' ? 'Savings' : 'Current'} · •••• ${accounts[i].accountNumber.slice(-4)}` }))
        );
        tagged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setTransactions(tagged);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load transactions.'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [accountIdsKey]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;

    return transactions.filter((tx) => {
      if (q && !(tx.description?.toLowerCase().includes(q) || tx.reference?.toLowerCase().includes(q))) {
        return false;
      }
      if (accountFilter !== 'all' && String(tx._accountId) !== String(accountFilter)) {
        return false;
      }
      if (typeFilter === 'credit' && !isCredit(tx.type)) return false;
      if (typeFilter === 'debit' && isCredit(tx.type)) return false;
      if (!withinPreset(tx.createdAt, datePreset)) return false;
      if (min !== null && Number(tx.amount) < min) return false;
      if (max !== null && Number(tx.amount) > max) return false;
      return true;
    });
  }, [transactions, searchText, accountFilter, typeFilter, datePreset, minAmount, maxAmount]);

  const activeFilterCount =
    (accountFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (datePreset !== 'all' ? 1 : 0) +
    (minAmount ? 1 : 0) +
    (maxAmount ? 1 : 0);

  const clearFilters = () => {
    setAccountFilter('all');
    setTypeFilter('all');
    setDatePreset('all');
    setMinAmount('');
    setMaxAmount('');
  };

  const totalCredit = filtered.filter((tx) => isCredit(tx.type)).reduce((s, tx) => s + Number(tx.amount), 0);
  const totalDebit = filtered.filter((tx) => !isCredit(tx.type)).reduce((s, tx) => s + Number(tx.amount), 0);

  return (
    <>
      <div className="topbar">
        <div className="greeting">
          <h1>Ledger</h1>
          <p>Every transaction across all your accounts.</p>
        </div>
        <div className="topbar-right">
          <div className="search-box ledger-search">
            🔍
            <input
              type="text"
              placeholder="Search by description or reference..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ledger-filter-bar">
        <div className="ledger-filter-pills">
          <button
            className={`filter-pill ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-pill ${typeFilter === 'credit' ? 'active' : ''}`}
            onClick={() => setTypeFilter('credit')}
          >
            Money in
          </button>
          <button
            className={`filter-pill ${typeFilter === 'debit' ? 'active' : ''}`}
            onClick={() => setTypeFilter('debit')}
          >
            Money out
          </button>

          <select
            className="filter-select"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="all">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.type === 'SAVINGS' ? 'Savings' : 'Current'} · •••• {a.accountNumber.slice(-4)}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>

          <button
            className={`filter-pill filter-more ${showMoreFilters ? 'active' : ''}`}
            onClick={() => setShowMoreFilters((s) => !s)}
          >
            Amount {(minAmount || maxAmount) ? '●' : ''}
          </button>

          {activeFilterCount > 0 && (
            <button className="filter-clear" onClick={clearFilters}>Clear filters ✕</button>
          )}
        </div>

        {showMoreFilters && (
          <div className="ledger-amount-range">
            <input
              type="number"
              placeholder="Min ₹"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
            <span>to</span>
            <input
              type="number"
              placeholder="Max ₹"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        )}
      </div>

      {!loading && !error && transactions.length > 0 && (
        <div className="ledger-summary">
          <div className="ledger-summary-item">
            <span className="ledger-summary-label">SHOWING</span>
            <span className="ledger-summary-val">{filtered.length} of {transactions.length}</span>
          </div>
          <div className="ledger-summary-item">
            <span className="ledger-summary-label">MONEY IN</span>
            <span className="ledger-summary-val trend-up">+{formatMoney(totalCredit)}</span>
          </div>
          <div className="ledger-summary-item">
            <span className="ledger-summary-label">MONEY OUT</span>
            <span className="ledger-summary-val" style={{ color: 'var(--ink)' }}>−{formatMoney(totalDebit)}</span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24 }}>Loading transactions…</div>}
        {error && !loading && (
          <div style={{ padding: 24, color: 'var(--danger)' }}>{error}</div>
        )}
        {!loading && !error && (
          <>
            {filtered.map((tx) => (
              <div className="tx-row" key={tx.reference} style={{ padding: '15px 22px' }}>
                <div className="tx-icon">{TX_ICON[tx.type] || '•'}</div>
                <div className="tx-info">
                  <div className="tx-name">{tx.description || tx.type}</div>
                  <div className="tx-meta">{tx.reference} · {tx._accountLabel} · {formatDate(tx.createdAt)}</div>
                </div>
                <span className={`tx-status ${tx.status === 'COMPLETED' ? 'done' : 'pending'}`}>
                  {tx.status === 'COMPLETED' ? 'Completed' : 'Processing'}
                </span>
                <div className={`tx-amt ${isCredit(tx.type) ? 'pos' : 'neg'}`}>
                  {isCredit(tx.type) ? '+' : '−'}{formatMoney(tx.amount)}
                </div>
              </div>
            ))}
            {filtered.length === 0 && transactions.length > 0 && (
              <div style={{ padding: 24, color: 'var(--ink-faint)', fontSize: 13.5 }}>
                No transactions match your filters.
              </div>
            )}
            {transactions.length === 0 && (
              <div style={{ padding: 24, color: 'var(--ink-faint)', fontSize: 13.5 }}>
                No transactions yet.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
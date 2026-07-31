import { useState } from 'react';
import { createAccount } from '../services/accountService';

function formatMoney(amount) {
  const n = Number(amount);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCardNumber(accountNumber) {
  // group into 4s for a card-like look — purely cosmetic grouping of the
  // same underlying account number, not a separate card number system
  return accountNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Detailed view of the current user's own accounts. Each account renders as
 * one row: its virtual-card visual on the left (flips on hover or click) and
 * its detail card — full account number with copy-to-clipboard, status, and
 * a shortcut into the Ledger — on the right.
 *
 * onAccountAdded() is called after a new account is successfully opened, so
 * DashboardPage can refresh its `accounts` list (which flows back down as a
 * prop and updates this view automatically).
 */
export default function AccountsView({ accounts, onViewLedger, onAccountAdded, onSendMoney, onAddMoney, onToggleFreeze }) {
  const [copiedId, setCopiedId] = useState(null);
  const [flippedId, setFlippedId] = useState(null);
  const [freezingId, setFreezingId] = useState(null);

  const [showAddPicker, setShowAddPicker] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const hasSavings = accounts.some((a) => a.type === 'SAVINGS');
  const hasCurrent = accounts.some((a) => a.type === 'CURRENT');
  const canAddMore = !hasSavings || !hasCurrent;

  const handleCopy = async (account) => {
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      setCopiedId(account.id);
      setTimeout(() => setCopiedId((prev) => (prev === account.id ? null : prev)), 1800);
    } catch {
      // clipboard API unavailable/blocked — fail silently, nothing to show for it
    }
  };

  const handleAddAccount = async (type) => {
    setAddError('');
    setAddLoading(true);
    try {
      await createAccount(type);
      setShowAddPicker(false);
      await onAccountAdded?.();
    } catch (err) {
      setAddError(err.message || 'Could not open that account. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggleFreeze = async (account) => {
    setFreezingId(account.id);
    try {
      await onToggleFreeze?.(account.id);
    } finally {
      setFreezingId(null);
    }
  };

  return (
    <>
      <div className="accounts-section-head">
        <div className="greeting">
          <h1>Accounts</h1>
          <p>All your Ledgerline accounts, in one place.</p>
        </div>
        {canAddMore && accounts.length > 0 && (
          <div className="add-account-wrap">
            <button
              type="button"
              className="add-account-btn"
              onClick={() => { setShowAddPicker((s) => !s); setAddError(''); }}
            >
              + Add account
            </button>

            {showAddPicker && (
              <div className="add-account-picker">
                {!hasSavings && (
                  <button
                    type="button"
                    className="add-account-option"
                    disabled={addLoading}
                    onClick={() => handleAddAccount('SAVINGS')}
                  >
                    <span className="acc-icon sav" style={{ width: 28, height: 28, fontSize: 12 }}>◈</span>
                    Open a Savings account
                  </button>
                )}
                {!hasCurrent && (
                  <button
                    type="button"
                    className="add-account-option"
                    disabled={addLoading}
                    onClick={() => handleAddAccount('CURRENT')}
                  >
                    <span className="acc-icon cur" style={{ width: 28, height: 28, fontSize: 12 }}>▤</span>
                    Open a Current account
                  </button>
                )}
                {addLoading && <div className="add-account-loading">Opening account…</div>}
                {addError && <div className="add-account-error">{addError}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {accounts.length === 0 && (
        <div className="card" style={{ padding: 24, color: 'var(--ink-faint)', fontSize: 13.5 }}>
          No accounts yet.
        </div>
      )}

      <div className="accounts-pairs">
        {accounts.map((a) => (
          <div className="account-pair-row" key={a.id}>
            {/* Virtual card — flips on hover automatically; click toggles a
                "pinned" flipped state that also works on touch devices where
                there's no hover. */}
            <div
              className={`virtual-card ${a.type === 'CURRENT' ? 'virtual-card-current' : ''} ${a.status !== 'ACTIVE' ? 'virtual-card-frozen' : ''} ${flippedId === a.id ? 'flipped' : ''}`}
              onClick={() => setFlippedId((prev) => (prev === a.id ? null : a.id))}
            >
              <div className="virtual-card-inner">
                {/* FRONT */}
                <div className="virtual-card-face virtual-card-front">
                  <div className="virtual-card-top">
                    <span className="virtual-card-brand">Ledgerline</span>
                    <span className="virtual-card-type">{a.type === 'SAVINGS' ? 'Savings' : 'Current'}</span>
                  </div>
                  <div className="virtual-card-chip">▮▮</div>
                  <div className="virtual-card-number">{formatCardNumber(a.accountNumber)}</div>
                  <div className="virtual-card-bottom">
                    <div>
                      <div className="virtual-card-label">BALANCE</div>
                      <div className="virtual-card-value">{formatMoney(a.balance)}</div>
                    </div>
                    <div className={`virtual-card-status ${a.status === 'ACTIVE' ? 'ok' : 'frozen'}`}>
                      {a.status === 'ACTIVE' ? '● Active' : '❄ Frozen'}
                    </div>
                  </div>
                </div>

                {/* BACK */}
                <div className="virtual-card-face virtual-card-back">
                  <div className="virtual-card-stripe"></div>
                  <div className="virtual-card-back-row">
                    <span className="virtual-card-back-label">Account holder</span>
                    <span className="virtual-card-back-val">Ledgerline customer</span>
                  </div>
                  <div className="virtual-card-back-row">
                    <span className="virtual-card-back-label">Account no.</span>
                    <span className="virtual-card-back-val mono">{a.accountNumber}</span>
                  </div>
                  <div className="virtual-card-tap-hint">Hover or tap to flip</div>
                </div>
              </div>
            </div>

            {/* Detail card, side by side with its card */}
            <div className="card account-detail-card">
              <div className="account-detail-top">
                <div className={`acc-icon ${a.type === 'SAVINGS' ? 'sav' : 'cur'}`} style={{ width: 40, height: 40, fontSize: 17 }}>
                  {a.type === 'SAVINGS' ? '◈' : '▤'}
                </div>
                <span className={`admin-badge ${a.status === 'ACTIVE' ? 'mint' : 'amber'}`}>
                  {a.status}
                </span>
              </div>

              <div className="account-detail-name">
                {a.type === 'SAVINGS' ? 'Savings account' : 'Current account'}
              </div>

              <div className="account-detail-balance">{formatMoney(a.balance)}</div>
              <div className="account-detail-balance-label">AVAILABLE BALANCE</div>

              <div className="account-detail-number-row">
                <div>
                  <div className="account-detail-number-label">ACCOUNT NUMBER</div>
                  <div className="account-detail-number mono">{a.accountNumber}</div>
                </div>
                <button
                  type="button"
                  className="account-copy-btn"
                  onClick={() => handleCopy(a)}
                >
                  {copiedId === a.id ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div className="account-action-row">
                <button
                  type="button"
                  className="account-action-btn"
                  onClick={() => onSendMoney?.(a.id)}
                  disabled={a.status !== 'ACTIVE'}
                >
                  ⇄ Send
                </button>
                <button
                  type="button"
                  className="account-action-btn"
                  onClick={() => onAddMoney?.(a.id)}
                  disabled={a.status !== 'ACTIVE'}
                >
                  ↓ Add money
                </button>
                <button
                  type="button"
                  className={`account-action-btn ${a.status !== 'ACTIVE' ? 'account-action-btn-unfreeze' : ''}`}
                  onClick={() => handleToggleFreeze(a)}
                  disabled={freezingId === a.id}
                >
                  {freezingId === a.id
                    ? '…'
                    : a.status === 'ACTIVE' ? '⏻ Freeze' : '✓ Unfreeze'}
                </button>
              </div>

              <button
                type="button"
                className="account-view-ledger-btn"
                onClick={onViewLedger}
              >
                View transactions →
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
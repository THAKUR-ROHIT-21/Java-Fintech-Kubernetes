import { useEffect, useRef, useState } from 'react';
import { lookupAccount, transfer } from '../services/accountService';

function formatMoney(amount) {
  const n = Number(amount);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RECENTS_KEY = 'ledgerline_recent_recipients';
const MAX_RECENTS = 5;

function getRecentRecipients() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentRecipient(recipient) {
  const current = getRecentRecipients();
  // de-dupe by account number, most-recent first, capped
  const withoutThisOne = current.filter((r) => r.accountNumber !== recipient.accountNumber);
  const updated = [recipient, ...withoutThisOne].slice(0, MAX_RECENTS);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Self-contained "Send money" modal. Owns all of its own state so
 * DashboardPage doesn't have to — it just renders this and passes:
 *   accounts   — the current user's own accounts (for the "from" dropdown)
 *   onClose()  — called when the modal should close without completing anything
 *   onSuccess()— called after a successful transfer, so the dashboard can refresh
 */
export default function SendMoneyModal({ accounts, initialFromAccountId, onClose, onSuccess }) {
  const [fromAccountId, setFromAccountId] = useState(initialFromAccountId ?? accounts[0]?.id ?? '');
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle'); // 'idle' | 'submitting' | 'success'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submittingRef = useRef(false);

  const [recipient, setRecipient] = useState(null);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');

  const [recentRecipients, setRecentRecipients] = useState(getRecentRecipients);

  // Debounced auto-lookup as the recipient's account number is typed.
  useEffect(() => {
    const trimmed = toAccountNumber.trim();

    if (trimmed.length < 8) {
      setRecipient(null);
      setRecipientError('');
      setRecipientLoading(false);
      return;
    }

    setRecipientLoading(true);
    setRecipientError('');
    const timer = setTimeout(() => {
      lookupAccount(trimmed)
        .then((data) => {
          setRecipient(data);
          setRecipientError('');
        })
        .catch((err) => {
          setRecipient(null);
          setRecipientError(
            err.status === 404 ? 'No account found with that number.' : (err.message || 'Could not look up this account.')
          );
        })
        .finally(() => setRecipientLoading(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [toAccountNumber]);

  const handleClose = () => {
    if (submittingRef.current) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError('');

    const fromAccount = accounts.find((a) => String(a.id) === String(fromAccountId));
    const amountNum = Number(amount);

    if (!fromAccount) {
      setError('Choose an account to send from.');
      return;
    }
    if (!recipient) {
      setError('Enter a valid recipient account number.');
      return;
    }
    if (fromAccount.accountNumber === recipient.accountNumber) {
      setError('You cannot send money to the same account.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (amountNum > Number(fromAccount.balance)) {
      setError('Insufficient balance in the selected account.');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setPhase('submitting');
    try {
      const idempotencyKey = `transfer-${fromAccount.accountNumber}-${recipient.accountNumber}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await transfer({
        fromAccountNumber: fromAccount.accountNumber,
        toAccountNumber: recipient.accountNumber,
        amount: amountNum,
        description: note || `Transfer to ${recipient.ownerName}`,
        idempotencyKey,
      });
      setSuccess(`₹${amountNum.toLocaleString('en-IN')} sent to ${recipient.ownerName}.`);
      saveRecentRecipient({
        accountNumber: recipient.accountNumber,
        ownerName: recipient.ownerName,
        type: recipient.type,
      });
      await onSuccess();
      setPhase('success');
      setTimeout(() => {
        submittingRef.current = false;
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Could not complete the transfer. Please try again.');
      submittingRef.current = false;
      setLoading(false);
      setPhase('idle');
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Send money</h3>
          <button className="modal-close" onClick={handleClose} disabled={loading}>✕</button>
        </div>
        <p className="modal-sub">Enter the recipient's account number — we'll look them up automatically.</p>

        <div className="modal-form-shell">
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="sendFromAccount">From account</label>
              <div className="input-wrap">
                <select
                  id="sendFromAccount"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  disabled={loading}
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
              <label htmlFor="sendToAccount">Recipient account number</label>

              {recentRecipients.length > 0 && (
                <div className="recent-recipients-row">
                  {recentRecipients.map((r) => (
                    <button
                      key={r.accountNumber}
                      type="button"
                      className={`recent-chip ${toAccountNumber === r.accountNumber ? 'active' : ''}`}
                      onClick={() => setToAccountNumber(r.accountNumber)}
                      disabled={loading}
                    >
                      <span className="recent-chip-avatar">
                        {r.ownerName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                      {r.ownerName.split(' ')[0]}
                    </button>
                  ))}
                </div>
              )}

              <div className="input-wrap">
                <input
                  type="text"
                  id="sendToAccount"
                  inputMode="numeric"
                  placeholder="12-digit account number"
                  value={toAccountNumber}
                  onChange={(e) => setToAccountNumber(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            {recipientLoading && (
              <div className="recipient-preview recipient-preview-loading">
                <div className="modal-spinner modal-spinner-sm"></div>
                <span>Looking up account…</span>
              </div>
            )}
            {!recipientLoading && recipientError && (
              <div className="recipient-preview recipient-preview-error">{recipientError}</div>
            )}
            {!recipientLoading && recipient && (
              <div className="recipient-preview recipient-preview-found">
                <div className="recipient-avatar">
                  {recipient.ownerName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="recipient-info">
                  <div className="recipient-name">{recipient.ownerName}</div>
                  <div className="recipient-meta">
                    {recipient.type === 'SAVINGS' ? 'Savings' : 'Current'} · •••• {recipient.accountNumber.slice(-4)} · {recipient.maskedPhone}
                  </div>
                </div>
                <div className="recipient-check">✓</div>
              </div>
            )}

            <div className="field">
              <label htmlFor="sendAmount">Amount (₹)</label>
              <div className="input-wrap">
                <input
                  type="number"
                  id="sendAmount"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 2000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="sendNote">Note (optional)</label>
              <div className="input-wrap">
                <input
                  type="text"
                  id="sendNote"
                  placeholder="e.g. Rent split"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-submit" disabled={loading || !recipient}>
              {loading ? 'Sending…' : 'Send money'}
            </button>
          </form>

          <div className={`modal-loading-overlay ${phase !== 'idle' ? 'visible' : ''}`}>
            {phase === 'success' ? (
              <>
                <div className="modal-success-tick">✓</div>
                <span>{success}</span>
              </>
            ) : (
              <>
                <div className="modal-spinner"></div>
                <span>Sending money…</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
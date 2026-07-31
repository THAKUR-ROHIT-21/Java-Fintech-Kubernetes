import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', keepLoggedIn: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <div className="panel-left">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 12h16M4 6h10M4 18h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          Ledgerline
        </Link>

        <div className="panel-mid">
          <span className="eyebrow"><span className="dot"></span>Welcome back</span>
          <h1>Your money, exactly where you left it.</h1>
          <p>
            Log in to see your balance update in real time, send a transfer
            in seconds, or check where every rupee went this month.
          </p>
        </div>

        <div className="mini-card">
          <div className="mini-card-top">
            <div>
              <div className="mini-label">AVAILABLE BALANCE</div>
              <div className="mini-bal">₹XX,00,104</div>
            </div>
            <div className="mini-badge">● Live</div>
          </div>
          <div className="mini-row">
            <span>Salary — Northwind Pvt Ltd</span>
            <span className="amt-pos">+₹86,000.00</span>
          </div>
          <div className="mini-row">
            <span>Transfer to Aditi Rao</span>
            <span className="amt-neg">−₹4,200.00</span>
          </div>
          <div className="mini-row">
            <span>Electricity Bill</span>
            <span className="amt-neg">−₹1,860.00</span>
          </div>
        </div>

        <div className="panel-quote">
          <strong>"I can actually see my rent land the same evening."</strong>
          <br />
          — Rohan Mehta, Ledgerline customer since 2024
        </div>
      </div>

      <div className="panel-right">
        <div className="form-wrap">
          <div className="form-head">
            <h2>Log in to your account</h2>
            <p>
              New to Ledgerline? <Link to="/signup">Open an account</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <div className="input-wrap">
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="row-between">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  name="keepLoggedIn"
                  checked={form.keepLoggedIn}
                  onChange={handleChange}
                />
                Keep me logged in
              </label>
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          {error && <div className="form-error">{error}</div>}

          <div className="divider">or continue with</div>

          <button type="button" className="btn-alt">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09A6.59 6.59 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="security-note">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Your session is encrypted end-to-end. We'll never ask for your
            password by email or phone.
          </div>

          <div className="form-foot">
            By logging in, you agree to our <Link to="/terms">Terms</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
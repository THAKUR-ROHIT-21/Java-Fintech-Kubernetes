import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/authService';

export default function SignupPage() {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    agreeTerms: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (!/^\d{10}$/.test(form.phone)) next.phone = 'Enter a valid 10-digit phone number';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (!form.agreeTerms) next.agreeTerms = 'You must accept the terms to continue';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      navigate('/dashboard');
    } catch (err) {
      if (err.fields) {
        setErrors((prev) => ({ ...prev, ...err.fields }));
      } else {
        setServerError(err.message || 'Could not create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    const p = form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };
  const strength = passwordStrength();
  const strengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['var(--danger)', 'var(--danger)', 'var(--amber)', 'var(--mint)', 'var(--mint)'][strength];

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
          <span className="eyebrow"><span className="dot"></span>Free forever, no hidden fees</span>
          <h1>An account that's ready before your coffee is.</h1>
          <p>
            Open a savings or current account in under three minutes — no
            branch visit, no paperwork, no waiting for approval.
          </p>
        </div>

        <div className="mini-card">
          <div className="mini-card-top">
            <div>
              <div className="mini-label">WHAT YOU GET</div>
              <div className="mini-bal" style={{ fontSize: 18 }}>Instant account, instant transfers</div>
            </div>
            <div className="mini-badge">● Free</div>
          </div>
          <div className="mini-row">
            <span>Zero minimum balance</span>
            <span className="amt-pos">✓</span>
          </div>
          <div className="mini-row">
            <span>Deposits insured up to ₹5,00,000</span>
            <span className="amt-pos">✓</span>
          </div>
          <div className="mini-row">
            <span>Freeze your card anytime, in one tap</span>
            <span className="amt-pos">✓</span>
          </div>
        </div>

        <div className="panel-quote">
          <strong>"Account opened, first transfer sent — all in one coffee break."</strong>
          <br />
          — Aditi Rao, Ledgerline customer since 2025
        </div>
      </div>

      <div className="panel-right">
        <div className="form-wrap">
          <div className="form-head">
            <h2>Create your account</h2>
            <p>
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field ${errors.fullName ? 'field-error' : ''}`}>
              <label htmlFor="fullName">Full name</label>
              <div className="input-wrap">
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  placeholder="As per your government ID"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={handleChange}
                />
              </div>
              {errors.fullName && <div className="error-msg">{errors.fullName}</div>}
            </div>

            <div className={`field ${errors.email ? 'field-error' : ''}`}>
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
                />
              </div>
              {errors.email && <div className="error-msg">{errors.email}</div>}
            </div>

            <div className={`field ${errors.phone ? 'field-error' : ''}`}>
              <label htmlFor="phone">Phone number</label>
              <div className="input-wrap">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              {errors.phone && <div className="error-msg">{errors.phone}</div>}
            </div>

            <div className={`field ${errors.password ? 'field-error' : ''}`}>
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  type={showPw ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="toggle-pw"
                  onClick={() => setShowPw((s) => !s)}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
              {form.password && (
                <div className="pw-strength">
                  <div className="pw-strength-track">
                    <div
                      className="pw-strength-fill"
                      style={{ width: `${(strength / 4) * 100}%`, background: strengthColor }}
                    ></div>
                  </div>
                  <span className="pw-strength-label" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
              )}
              {errors.password && <div className="error-msg">{errors.password}</div>}
            </div>

            <div className={`field-checkbox ${errors.agreeTerms ? 'field-error' : ''}`}>
              <label className="checkbox-row checkbox-row-top">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={form.agreeTerms}
                  onChange={handleChange}
                />
                <span>
                  I agree to Ledgerline's <Link to="/terms">Terms of Service</Link> and{' '}
                  <Link to="/privacy">Privacy Policy</Link>
                </span>
              </label>
              {errors.agreeTerms && <div className="error-msg">{errors.agreeTerms}</div>}
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          {serverError && <div className="form-error">{serverError}</div>}

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
            Your information is encrypted end-to-end. We'll verify your
            identity with a PAN and government ID after sign-up.
          </div>
        </div>
      </div>
    </div>
  );
}
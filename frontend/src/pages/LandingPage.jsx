import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

function useReveal() {
  const containerRef = useRef(null);

  useEffect(() => {
    const els = containerRef.current
      ? containerRef.current.querySelectorAll('[data-reveal]')
      : [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return containerRef;
}

export default function LandingPage() {
  const containerRef = useReveal();

  return (
    <div ref={containerRef}>
      <nav>
        <div className="container nav-inner">
          <div className="logo">
            <span className="logo-mark">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12h16M4 6h10M4 18h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            Ledgerline
          </div>
          <div className="nav-links">
            <a href="#platform">Platform</a>
            <a href="#security">Security</a>
            <a href="#how">How it works</a>
            <a href="#trust">Trust</a>
          </div>
          <div className="nav-cta">
            <Link to="/login" className="btn btn-ghost">Log in</Link>
            <Link to="/signup" className="btn btn-primary">Open an account</Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-mesh"></div>
        <div className="container">
          <div className="hero-top">
            <span className="eyebrow">
              <span className="dot"></span>Trusted by 40,000+ customers across India
            </span>
            <h1>
              Banking that keeps up with{' '}
              <span className="accent-text">your life, not the other way around.</span>
            </h1>
            <p className="lede">
              Open an account in minutes, send money instantly, and see every
              rupee the moment it moves — no branch visits, no waiting on
              hold, no surprises.
            </p>
            <div className="hero-actions">
              <Link to="/signup" className="btn btn-primary btn-lg">Open an account — it's free</Link>
              <a href="#" className="btn btn-line btn-lg">Take a quick tour</a>
            </div>
            <div className="hero-note">No paperwork · No branch visit · Ready in under 3 minutes</div>
          </div>
        </div>

        <div className="dash-wrap">
          <div className="dash" data-reveal>
            <div className="dash-bar">
              <div className="dash-dots"><span></span><span></span><span></span></div>
              <div className="dash-path">ledgerline.app/dashboard</div>
              <div style={{ width: 60 }}></div>
            </div>
            <div className="dash-body">
              <div className="dash-side">
                <div className="dash-side-item active">◆ &nbsp;Overview</div>
                <div className="dash-side-item">↗ &nbsp;Transfers</div>
                <div className="dash-side-item">▤ &nbsp;Ledger</div>
                <div className="dash-side-item">◐ &nbsp;Accounts</div>
                <div className="dash-side-item">✎ &nbsp;Audit log</div>
                <div className="dash-side-item">⚙ &nbsp;Settings</div>
              </div>
              <div className="dash-main">
                <div className="dash-metrics">
                  <div className="metric-card">
                    <div className="metric-label">AVAILABLE BALANCE</div>
                    <div className="metric-val">₹24,89,104</div>
                    <div className="metric-trend trend-up">▲ ₹76,200 this week</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">MONTHLY INTEREST EARNED</div>
                    <div className="metric-val">₹4,180</div>
                    <div className="metric-trend trend-up">▲ 12% vs last month</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">TRANSFERS THIS MONTH</div>
                    <div className="metric-val">38</div>
                    <div className="metric-trend" style={{ color: 'var(--ink-faint)' }}>All completed instantly</div>
                  </div>
                </div>
                <div className="chart-card">
                  <div className="chart-head">
                    <span>Spending & income overview</span>
                    <span className="mono">LAST 30 DAYS</span>
                  </div>
                  <svg className="sparkline" viewBox="0 0 520 90" width="100%" height="90" preserveAspectRatio="none">
                    <path className="fill" d="M0,70 C40,60 60,30 100,38 C140,46 160,15 200,20 C240,25 260,55 300,48 C340,41 360,10 400,18 C440,26 460,50 500,40 L520,40 L520,90 L0,90 Z" fill="#5B6FE0" />
                    <path d="M0,70 C40,60 60,30 100,38 C140,46 160,15 200,20 C240,25 260,55 300,48 C340,41 360,10 400,18 C440,26 460,50 500,40" fill="none" stroke="#5B6FE0" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="strip">
        <div className="container strip-inner">
          <span className="strip-label">WHY PEOPLE SWITCH TO US</span>
          <div className="strip-marks">
            <span>RBI-licensed</span>
            <span>Deposits insured up to ₹5,00,000</span>
            <span>4.8★ on the App Store</span>
            <span>Zero hidden fees</span>
            <span>24/7 human support</span>
          </div>
        </div>
      </div>

      <section className="section" id="platform">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow">WHAT YOU GET</span>
            <h2>Everything you need from a bank account — and nothing that gets in your way.</h2>
            <p>No monthly fees buried in fine print, no five-day waits, no calling a branch to check your own balance.</p>
          </div>

          <div className="bento" data-reveal>
            <div className="bento-card wide">
              <span className="bento-tag">MOST USED</span>
              <div className="bento-icon">⇄</div>
              <h3>Send money instantly, any time</h3>
              <p>Transfer to anyone, any bank, any hour — including weekends and holidays. It lands in seconds, not "1-2 business days."</p>
              <div className="mini-bars">
                <div style={{ height: '40%' }}></div>
                <div style={{ height: '65%' }}></div>
                <div style={{ height: '30%' }}></div>
                <div style={{ height: '80%' }}></div>
                <div style={{ height: '55%' }}></div>
                <div style={{ height: '90%' }}></div>
                <div style={{ height: '45%' }}></div>
                <div style={{ height: '70%' }}></div>
              </div>
            </div>
            <div className="bento-card">
              <div className="bento-icon">◈</div>
              <h3>Savings & current accounts</h3>
              <p>Open either in under three minutes, right from your phone.</p>
            </div>
            <div className="bento-card tall">
              <span className="bento-tag">POPULAR</span>
              <div className="bento-icon">▤</div>
              <h3>Every transaction, always visible</h3>
              <p>Search your entire history in seconds. See exactly what you spent, where, and what your balance was right after — no more guessing.</p>
              <p style={{ marginTop: 16, color: 'var(--ink-faint)', fontSize: 12.5, fontFamily: "'IBM Plex Mono',monospace" }}>
                → download statements as PDF anytime
              </p>
            </div>
            <div className="bento-card">
              <div className="bento-icon">◐</div>
              <h3>Built for families & teams</h3>
              <p>Give trusted people limited access to shared accounts, safely.</p>
            </div>
            <div className="bento-card">
              <div className="bento-icon">⏻</div>
              <h3>Freeze your card in one tap</h3>
              <p>Lost your card or spotted something odd? Lock it instantly from the app — no call center, no waiting.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight" id="how">
        <div className="container">
          <div className="sec-head">
            <span className="sec-eyebrow">HOW IT WORKS</span>
            <h2>From sign-up to your first transfer.</h2>
          </div>
          <div className="rail" data-reveal>
            <div className="rail-track">
              <div className="rail-line-fill"></div>
              <div className="rail-step">
                <div className="rail-num">01</div>
                <h4>Verify identity</h4>
                <p>PAN and a government ID, confirmed in minutes.</p>
              </div>
              <div className="rail-step">
                <div className="rail-num">02</div>
                <h4>Open account</h4>
                <p>Savings or current — account number issued instantly.</p>
              </div>
              <div className="rail-step">
                <div className="rail-num">03</div>
                <h4>Fund it</h4>
                <p>Link a bank or deposit directly; funds clear in seconds.</p>
              </div>
              <div className="rail-step">
                <div className="rail-num">04</div>
                <h4>Move money</h4>
                <p>Every action lands in your ledger the instant it happens.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="security">
        <div className="container">
          <div className="security" data-reveal>
            <div>
              <span className="security-eyebrow">YOUR MONEY, PROTECTED</span>
              <h2>We take your money as seriously as you do.</h2>
              <p className="desc">
                Every transfer is checked and confirmed before it's final —
                so you'll never see a payment go through twice, or a balance
                that's briefly wrong. Your money is exactly where you last
                saw it, always.
              </p>
              <ul className="sec-list">
                <li><span className="sec-check">✓</span> Every rupee tracked to the paisa — no rounding errors, ever</li>
                <li><span className="sec-check">✓</span> Duplicate payments are automatically blocked</li>
                <li><span className="sec-check">✓</span> Your session stays secure and logs out when it should</li>
                <li><span className="sec-check">✓</span> A permanent record of every transaction, for your peace of mind</li>
              </ul>
            </div>
            <div className="stat-grid">
              <div className="stat-cell"><div className="stat-num">0</div><div className="stat-cap">DUPLICATE PAYMENT INCIDENTS</div></div>
              <div className="stat-cell"><div className="stat-num">&lt;1 sec</div><div className="stat-cap">AVG. TRANSFER TIME</div></div>
              <div className="stat-cell"><div className="stat-num">99.98%</div><div className="stat-cap">APP AVAILABILITY</div></div>
              <div className="stat-cell"><div className="stat-num">24/7</div><div className="stat-cap">FRAUD MONITORING</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight" id="trust">
        <div className="container">
          <div className="quote-panel" data-reveal>
            <blockquote>
              "I switched from my old bank after waiting three days for a
              transfer to clear. With Ledgerline, my rent lands the same
              evening — and I can actually see it happen."
            </blockquote>
            <div className="quote-who"><strong>Rohan Mehta</strong> — Ledgerline customer since 2024</div>
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <div className="cta" data-reveal>
            <h2>Your ledger, finally reconciled.</h2>
            <p>Open an account in under three minutes. No paperwork, no branch visit.</p>
            <Link to="/signup" className="btn btn-white btn-lg">Open an account — free</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="logo">
                <span className="logo-mark">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 12h16M4 6h10M4 18h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                Ledgerline
              </div>
              <p>A bank account built for how people actually live — instant transfers, honest fees, and a balance you can always trust.</p>
            </div>
            <div className="foot-col">
              <h5>PLATFORM</h5>
              <a href="#platform">Features</a>
              <a href="#security">Security</a>
              <a href="#how">How it works</a>
            </div>
            <div className="foot-col">
              <h5>COMPANY</h5>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#">Press</a>
            </div>
            <div className="foot-col">
              <h5>LEGAL</h5>
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
              <a href="#">Deposit insurance</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 LEDGERLINE FINANCIAL TECHNOLOGIES</span>
            <span>BANKING THAT KEEPS YOUR TRUST</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
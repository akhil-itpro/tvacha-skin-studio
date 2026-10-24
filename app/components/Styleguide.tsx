'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, CircleAlert, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { CONCERN_META } from '../../src/domain/catalog';
import { CONCERN_KEYS } from '../../src/domain/types';

const TOKENS = [
  { name: 'Tile', value: '#E9F1EE', use: 'The quiet background', ink: '#12262B' },
  { name: 'Label', value: '#FFFFFF', use: 'Paper, cards and surfaces', ink: '#12262B' },
  { name: 'Ink', value: '#12262B', use: 'Headings and body', ink: '#FFFFFF' },
  { name: 'Ink soft', value: '#46595D', use: 'Supporting words', ink: '#FFFFFF' },
  { name: 'Batch', value: '#1F6B63', use: 'Actions and positive states', ink: '#FFFFFF' },
  { name: 'Stamp', value: '#B23A48', use: 'Warnings that need a name', ink: '#FFFFFF' },
  { name: 'Line', value: '#C9D8D3', use: 'Hairlines, never body text', ink: '#12262B' },
];

export default function Styleguide() {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [printKey, setPrintKey] = useState(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeout.current) clearTimeout(timeout.current); }, []);
  function testLoading() {
    setLoading(true);
    timeout.current = setTimeout(() => setLoading(false), 1200);
  }
  return <div className="tv-guide" style={{ color: '#12262B', fontFamily: '"Atkinson Hyperlegible Next", sans-serif', maxWidth: 1120, margin: '0 auto', padding: '32px 0 72px' }}>
    <style>{`
      .tv-guide *{box-sizing:border-box}.tv-guide h1,.tv-guide h2,.tv-guide h3{font-family:"Archivo",sans-serif;letter-spacing:-.045em;line-height:1.06}.tv-guide h1{font-size:clamp(40px,7vw,76px);font-weight:700;max-width:780px;margin:20px 0}.tv-guide h2{font-size:30px;margin:8px 0 12px}.tv-guide h3{font-size:19px;margin:0 0 8px}.tv-guide p{line-height:1.5;margin:8px 0 16px}.tv-guide .sg-mono{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.06em}.tv-guide .sg-kicker{text-transform:uppercase;font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.15em;color:#46595D}.tv-guide .sg-section{border-top:1px solid #C9D8D3;padding-top:24px;margin-top:48px}.tv-guide .sg-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:16px}.tv-guide .sg-token{border:1px solid #C9D8D3;background:white;overflow:hidden}.tv-guide .sg-token-swatch{height:104px;padding:16px;display:flex;justify-content:space-between;align-items:flex-end}.tv-guide .sg-token-copy{padding:14px 16px}.tv-guide .sg-button{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:48px;padding:12px 20px;border:1px solid #1F6B63;background:#1F6B63;color:#fff;font:inherit;font-weight:600;cursor:pointer;border-radius:6px;text-decoration:none}.tv-guide .sg-button:hover{background:#18564F}.tv-guide .sg-button:focus-visible,.tv-guide input:focus-visible{outline:3px solid #1F6B63;outline-offset:4px}.tv-guide .sg-button.secondary{color:#1F6B63;background:transparent}.tv-guide .sg-button.text{color:#1F6B63;background:transparent;border-color:transparent;padding-inline:8px}.tv-guide .sg-button:disabled{cursor:wait;opacity:.7}.tv-guide .sg-specimen{background:white;border:1px solid #C9D8D3;padding:24px}.tv-guide .sg-paper{background:white;border:1px solid #12262B;padding:24px;position:relative;max-width:480px}.tv-guide .sg-paper-rule{height:7px;background:#12262B;margin:16px 0}.tv-guide .sg-swatch-row{display:grid;grid-template-columns:28px 1fr 76px;gap:12px;align-items:center;border-bottom:1px solid #C9D8D3;padding:10px 0}.tv-guide .sg-swatch-code{width:28px;height:36px;display:flex;align-items:center;justify-content:center;color:white;font-family:"IBM Plex Mono",monospace;font-size:12px}.tv-guide .sg-bars{display:flex;gap:4px;margin-top:5px}.tv-guide .sg-bar{width:22px;height:4px;background:#E9F1EE}.tv-guide .sg-sticker{border:1.5px solid #1F6B63;border-radius:50%;width:104px;height:104px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#1F6B63;font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.05em;font-size:10px;transform:rotate(-12deg);background:#E9F1EE}.tv-guide .sg-printed{animation:sg-print .6s cubic-bezier(.2,.65,.3,1) both}.tv-guide .sg-fill{animation:sg-fill .375s ease-out both;transform-origin:left}.tv-guide .sg-spin{animation:sg-spin 1s linear infinite}.tv-guide .sg-state{min-height:200px;border:1px solid #C9D8D3;padding:24px;background:#fff;display:flex;flex-direction:column;align-items:flex-start}.tv-guide .sg-line{height:8px;background:#E9F1EE;margin-top:10px}.tv-guide .sg-state p{font-size:14px;color:#46595D}.tv-guide .sg-swatch-card{display:flex;gap:14px;align-items:center;background:white;border:1px solid #C9D8D3;padding:16px}.tv-guide .sg-type-row{display:grid;grid-template-columns:minmax(110px,1fr) 3fr;gap:20px;padding:24px 0;border-bottom:1px solid #C9D8D3;align-items:baseline}.tv-guide .sg-principle{padding:16px 0;border-bottom:1px solid #C9D8D3}.tv-guide .sg-note{display:flex;gap:12px;align-items:flex-start;padding:16px;background:#E9F1EE;border-left:3px solid #1F6B63}.tv-guide .sg-sample-label{display:inline-block;border:1px solid #C9D8D3;padding:6px 8px;margin-bottom:16px;color:#46595D;font-size:10px}.tv-guide .sg-accessible-check{display:flex;align-items:center;gap:12px;min-height:48px;cursor:pointer}.tv-guide .sg-accessible-check input{width:20px;height:20px;accent-color:#1F6B63}.tv-guide .sg-two-col{display:grid;grid-template-columns:1fr 1fr;gap:32px}.tv-guide .sg-muted{color:#46595D}.tv-guide .sg-rule-detail{border-top:1px dashed #C9D8D3;margin-top:16px;padding-top:12px;font-size:10px;line-height:1.6}.tv-guide .sg-inline-link{color:#1F6B63;text-underline-offset:4px}.tv-guide .sg-chapter{display:flex;justify-content:space-between;gap:16px;align-items:center}.tv-guide .sg-tiny-title{margin-bottom:0;font-size:14px;font-weight:600}.tv-guide .sg-sample-footer{display:flex;justify-content:space-between;align-items:end;gap:8px;margin-top:24px}.tv-guide .sg-caption{font-size:12px;max-width:240px;line-height:1.5;color:#46595D}@keyframes sg-print{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes sg-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes sg-spin{to{transform:rotate(360deg)}}@media(max-width:640px){.tv-guide .sg-two-col{grid-template-columns:1fr}.tv-guide .sg-type-row{grid-template-columns:1fr;gap:12px}.tv-guide .sg-paper{padding:20px}.tv-guide .sg-chapter{align-items:start}}@media(prefers-reduced-motion:reduce){.tv-guide .sg-printed,.tv-guide .sg-fill,.tv-guide .sg-spin{animation:none!important}}
    `}</style>

    <div className="sg-chapter">
      <span className="sg-kicker">Tvacha / The working label</span>
      <span className="sg-mono sg-muted">DESIGN SYSTEM · 01</span>
    </div>
    <h1>A little more clarity.<br />A little less noise.</h1>
    <p style={{ maxWidth: 570, fontSize: 18, color: '#46595D' }}>A shade card meets the back of a bottle. Specific words, useful ingredients, and enough room to breathe.</p>
    <a className="sg-button text" href="#sg-palette">Explore the system <ArrowDown size={16} aria-hidden="true" /></a>

    <section className="sg-section" id="sg-palette" aria-labelledby="sg-palette-heading">
      <span className="sg-kicker">01 / Colour, with a purpose</span>
      <h2 id="sg-palette-heading">The everyday palette.</h2>
      <p className="sg-muted">Quiet surfaces. Deep ink. Warnings that say what they mean.</p>
      <div className="sg-grid">{TOKENS.map(token => <div className="sg-token" key={token.name}>
        <div className="sg-token-swatch" style={{ background: token.value, color: token.ink }}><span className="sg-mono">{token.name.toUpperCase()}</span><span className="sg-mono">{token.value}</span></div>
        <div className="sg-token-copy"><p style={{ margin: 0, fontSize: 13, color: '#46595D' }}>{token.use}</p></div>
      </div>)}</div>
    </section>

    <section className="sg-section" aria-labelledby="sg-concerns-heading">
      <span className="sg-kicker">02 / Read the swatch</span>
      <h2 id="sg-concerns-heading">Six concerns. Always named.</h2>
      <p className="sg-muted">A letter and a label travel with every colour. Colour alone never carries the meaning.</p>
      <div className="sg-grid">{CONCERN_KEYS.map(key => { const item = CONCERN_META[key]; return <div key={key} className="sg-swatch-card"><div className="sg-swatch-code" style={{ background: item.color, color: key === 'shine' ? '#000000' : '#FFFFFF', height: 48, width: 40 }}>{item.code}</div><div><strong style={{ display: 'block' }}>{item.name}</strong><span className="sg-mono sg-muted">{item.color}</span></div></div>; })}</div>
    </section>

    <section className="sg-section" aria-labelledby="sg-type-heading">
      <span className="sg-kicker">03 / Three voices, one label</span>
      <h2 id="sg-type-heading">Type that does its job.</h2>
      <div className="sg-type-row"><div className="sg-mono sg-muted">ARCHIVO / 700<br />Heading · 40 / 44</div><div style={{ fontFamily: '"Archivo",sans-serif', fontWeight: 700, fontSize: 40, letterSpacing: '-.045em', lineHeight: 1.1 }}>Know your skin.<br />Keep it simple.</div></div>
      <div className="sg-type-row"><div className="sg-mono sg-muted">ATKINSON HYPERLEGIBLE NEXT<br />Body · 18 / 28</div><p style={{ fontSize: 18, lineHeight: '28px', margin: 0, maxWidth: 460 }}>Your T-zone shines by lunch. A gentle cleanse, a light moisturiser, and one new active at a time.</p></div>
      <div className="sg-type-row"><div className="sg-mono sg-muted">IBM PLEX MONO<br />Label data · 12 / 20</div><div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: 12, lineHeight: '20px', letterSpacing: '.06em' }}>BATCH NO. TV—241026<br />NIACINAMIDE / CERAMIDES / SPF 50<br />REFERENCE PRICE · ₹349 / 50 G</div></div>
      <p style={{ fontSize: 12, color: '#46595D', marginTop: 16 }}>Spacing follows an 8 px grid. Phone layouts start with 16 px gutters. Interactive targets are at least 44 px.</p>
    </section>

    <section className="sg-section" aria-labelledby="sg-label-heading">
      <span className="sg-kicker">04 / The signature moment</span>
      <h2 id="sg-label-heading">A label worth keeping.</h2>
      <div className="sg-two-col" style={{ marginTop: 24 }}>
        <div key={printKey} className="sg-paper sg-printed" aria-label="Sample printed skin label. These are demonstration values, not a skin analysis.">
          <div className="sg-sample-label sg-mono">SAMPLE LABEL / NOT YOUR RESULT</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 8 }}><h3 style={{ fontSize: 36, margin: 0, fontWeight: 700 }}>Skin Label.</h3><span className="sg-mono">TVACHA / 01</span></div>
          <div className="sg-paper-rule" />
          <div className="sg-mono" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>YOUR DAILY INGREDIENT LIST</span><span>01 OF 01</span></div>
          <p className="sg-mono sg-muted" style={{ margin: '8px 0 16px', fontSize: 10 }}>BATCH · SAMPLE—241026 / COSMETIC GUIDANCE</p>
          {CONCERN_KEYS.map((key, index) => { const item = CONCERN_META[key]; const level = [2, 1, 2, 0, 1, 1][index]; return <div className="sg-swatch-row" key={key}>
            <div className="sg-swatch-code" style={{ background: item.color, color: key === 'shine' ? '#000000' : '#FFFFFF' }}>{item.code}</div>
            <div><strong style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</strong><div className="sg-bars" aria-label={`Sample level ${level} out of 3`}>{[0, 1, 2].map(bar => <span className={bar < level ? 'sg-bar sg-fill' : 'sg-bar'} key={bar} style={{ background: bar < level ? item.color : '#E9F1EE', animationDelay: `${index * 45}ms` }} />)}</div></div>
            <span className="sg-mono" style={{ fontSize: 9, textAlign: 'right', color: '#46595D' }}>{index === 5 ? 'LOW' : 'MEDIUM'}<br />CONFIDENCE</span>
          </div>; })}
          <div className="sg-rule-detail sg-mono">WHAT TO LOOK FOR<br /><strong>NIACINAMIDE / GLYCERIN / SPF 30+</strong></div>
          <div className="sg-sample-footer"><div className="sg-caption">AI estimate from one photo.<br />Not a diagnosis. Light changes results.</div><div className="sg-sticker"><span>Start small</span><strong style={{ fontSize: 14, margin: '4px 0' }}>PATCH TEST</strong><span>24—48 hrs</span></div></div>
        </div>
        <div style={{ alignSelf: 'center' }}>
          <span className="sg-kicker">The label, not the face.</span>
          <h3 style={{ fontSize: 30, marginTop: 12, maxWidth: 350 }}>Useful enough to read.<br />Honest enough to trust.</h3>
          <div className="sg-principle"><strong>Print, then settle.</strong><p className="sg-muted" style={{ fontSize: 14, marginBottom: 0 }}>The paper slides up. Six swatches fill in sequence. The whole moment takes about 600 ms.</p></div>
          <div className="sg-principle"><strong>Uncertainty belongs on the label.</strong><p className="sg-muted" style={{ fontSize: 14, marginBottom: 0 }}>Confidence stays beside the concern. We never fill gaps with a confident-looking score.</p></div>
          <div className="sg-principle"><strong>Less motion when you ask for it.</strong><p className="sg-muted" style={{ fontSize: 14, marginBottom: 0 }}>Your reduced-motion setting replaces the entrance with a simple appearance.</p></div>
          <button className="sg-button secondary" style={{ marginTop: 24 }} onClick={() => setPrintKey(value => value + 1)}><RotateCcw size={16} aria-hidden="true" /> Replay sample label</button>
        </div>
      </div>
    </section>

    <section className="sg-section" aria-labelledby="sg-action-heading">
      <span className="sg-kicker">05 / Clear next steps</span>
      <h2 id="sg-action-heading">Buttons, without the pressure.</h2>
      <div className="sg-specimen">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="sg-button" onClick={testLoading} disabled={loading}>{loading ? <><LoaderCircle className="sg-spin" size={18} aria-hidden="true" /> Checking sample…</> : <>Test loading state <ArrowRight size={18} aria-hidden="true" /></>}</button>
          <button type="button" className="sg-button secondary" onClick={() => setChecked(value => !value)}>{checked ? <Check size={18} aria-hidden="true" /> : null} {checked ? 'Sample step complete' : 'Tick a sample step'}</button>
          <a className="sg-button text" href="/privacy">Read the privacy draft <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
        <div style={{ borderTop: '1px solid #C9D8D3', marginTop: 24, paddingTop: 16 }}><label className="sg-accessible-check"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /><span>Moisturise. That’s one step done.</span></label><p className="sg-caption" style={{ marginBottom: 0 }}>Demo controls only. This does not change your routine or consent.</p></div>
      </div>
    </section>

    <section className="sg-section" aria-labelledby="sg-states-heading">
      <span className="sg-kicker">06 / Every state is part of the product</span>
      <h2 id="sg-states-heading">While we wait. When we can’t.</h2>
      <div className="sg-grid" style={{ marginTop: 24 }}>
        <div className="sg-state"><span className="sg-kicker">Loading example</span><div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}><LoaderCircle size={20} className="sg-spin" color="#1F6B63" aria-hidden="true" /><strong>Reading your label…</strong></div><p>One moment. We’re checking the details.</p><div aria-hidden="true" style={{ width: '100%', marginTop: 'auto' }}><div className="sg-line" style={{ width: '80%' }} /><div className="sg-line" style={{ width: '55%' }} /></div></div>
        <div className="sg-state"><span className="sg-kicker">Empty example</span><div style={{ border: '1px dashed #C9D8D3', width: 36, height: 42, margin: '20px 0 12px', display: 'grid', placeItems: 'center', color: '#46595D' }} aria-hidden="true">—</div><strong>A fresh shelf.</strong><p>Add what you already own. A good routine can start there.</p></div>
        <div className="sg-state" style={{ borderTop: '3px solid #B23A48' }}><span className="sg-kicker" style={{ color: '#B23A48' }}>Error example</span><CircleAlert size={24} color="#B23A48" aria-hidden="true" style={{ margin: '20px 0 12px' }} /><strong>We couldn’t read this photo.</strong><p>Face a window and keep the camera still. You can also use your quiz-only routine.</p></div>
      </div>
      <div className="sg-note" style={{ marginTop: 24 }}><ShieldCheck size={20} color="#1F6B63" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /><div><strong style={{ fontSize: 14 }}>The trust details stay visible.</strong><p style={{ fontSize: 14, color: '#46595D', margin: '4px 0 0' }}>AI estimate, not a doctor. Photo saving is a separate choice. Any commission is disclosed beside its product link.</p></div></div>
    </section>
    <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #C9D8D3', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><span className="sg-mono sg-muted">TVACHA / GOOD CARE. LESS NOISE.</span><a href="/" className="sg-inline-link" style={{ fontSize: 14 }}>Back to your skin check</a></div>
  </div>;
}


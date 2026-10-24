'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Camera, Check, CheckCheck, ChevronRight, Circle, Droplets, Leaf, LoaderCircle, Moon, Plus, Search, ShieldCheck, Sparkles, Sun, Trash2, X } from 'lucide-react';
import type { Product, ProductStep, RoutinePlan, ShelfItem } from '../../src/domain/types';
import { CONCERN_KEYS } from '../../src/domain/types';
import { CONCERN_META } from '../../src/domain/catalog';
import { compareAnalyses, daysUntilRescan } from '../../src/domain/recommendations';
import { api, dateKey, prettyDate, errorMessage, type AppState, type Scan } from '../../src/client/types';
import { Empty, PageHead, ProductArt, SkinLabel } from './UI';

type SharedProps = { state: AppState | null; refresh: () => Promise<any>; notify: (s: string) => void };
const STEPS: Record<ProductStep, string> = { cleanser: 'Cleanser', treatment: 'Treatment', moisturiser: 'Moisturiser', sunscreen: 'Sunscreen' };
function dayOffset(day: string, offset: number) { const date = new Date(`${day}T12:00:00+05:30`); date.setTime(date.getTime() + offset * 86400000); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date); }
function initialSlot(): 'AM' | 'PM' { return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date())) >= 17 ? 'PM' : 'AM'; }
function useDialog(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const element = ref.current;
    const focusables = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],textarea,[tabindex="0"]') || []);
    focusables()[0]?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const list = focusables(); if (!list.length) return;
      if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list[list.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === list[list.length - 1]) { event.preventDefault(); list[0].focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.removeEventListener('keydown', listener); if (previous instanceof HTMLElement) previous.focus(); };
  }, [open]);
  return ref;
}

export function Routine({ state, scan, plan, refresh, notify, goCheck, onLabel }: SharedProps & { scan: Scan | null; plan: RoutinePlan; goCheck: () => void; onLabel?: () => void }) {
  const [slot, setSlot] = useState<'AM' | 'PM'>(initialSlot);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const today = dateKey();
  if (!state) return <div className="section-card workspace-loading" role="status"><LoaderCircle size={24} className="spin" />Loading your routine…</div>;
  if (!scan || plan.stopped) return <><PageHead eyebrow="A LITTLE, EVERY DAY" title="Consistency looks good on you." text="A few thoughtful steps. A little less guesswork." /><Empty Icon={Sun} title="Your routine starts with you." text="Answer four quick questions to get a morning and evening routine that respects your skin and budget." action="Find my routine" onAction={goCheck} /></>;
  const steps = slot === 'AM' ? plan.am : plan.pm;
  const saved = (day: string, s: string, key: string) => state.ticks.some(t => t.date === day && t.slot === s && t.step === key && t.done);
  const checked = steps.filter(step => saved(today, slot, step.key)).length;
  const days = Array.from({ length: 7 }, (_, i) => dayOffset(today, i - 6));
  const hasActivity = (day: string) => state.ticks.some(t => t.date === day && t.done);
  let streak = 0;
  const first = hasActivity(today) ? 0 : -1;
  for (let i = first; i > -366; i--) { if (!hasActivity(dayOffset(today, i))) break; streak++; }
  async function toggle(step: string, done: boolean) {
    if (pending) return;
    setPending(step); setError('');
    try { await api('/api/routine', 'POST', { date: today, slot, step, done }); await refresh(); if (done && checked + 1 === steps.length) notify(`${slot === 'AM' ? 'Morning' : 'Evening'} routine checked in. A little care, done.`); }
    catch (err) { setError(errorMessage(err)); }
    finally { setPending(null); }
  }
  return <>
    <PageHead eyebrow="A LITTLE, EVERY DAY" title="Consistency looks good on you." text="Small steps. Your own pace. That’s the whole routine." />
    <div className="routine-layout">
      <section className="section-card daily-routine">
        <div className="routine-topline"><div><span className="eyebrow">TODAY’S RITUAL</span><p className="mono">{prettyDate(`${today}T12:00:00+05:30`)}</p></div><span className="routine-counter mono">{checked}/{steps.length} DONE</span></div>
        <div className="segmented routine-tabs" role="group" aria-label="Routine time"><button className={slot === 'AM' ? 'active' : ''} aria-pressed={slot === 'AM'} onClick={() => { setSlot('AM'); setError(''); }}><Sun size={18} />Morning</button><button className={slot === 'PM' ? 'active' : ''} aria-pressed={slot === 'PM'} onClick={() => { setSlot('PM'); setError(''); }}><Moon size={18} />Evening</button></div>
        <p className="routine-intro">{slot === 'AM' ? 'A gentle start. Sunscreen gets the last word.' : 'Wash the day off. Keep it simple.'}</p>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="routine-steps">{steps.map((step, index) => { const done = saved(today, slot, step.key); return <label className={'routine-step ' + (done ? 'is-done' : '')} key={step.key}>
          <input type="checkbox" checked={done} disabled={!!pending} onChange={e => void toggle(step.key, e.target.checked)} aria-label={`${step.title}${step.optional ? ', optional' : ''}`} />
          <span className="routine-tick" aria-hidden="true">{pending === step.key ? <LoaderCircle size={18} className="spin" /> : done ? <Check size={19} /> : <span className="mono">{String(index + 1).padStart(2, '0')}</span>}</span>
          <span className="routine-step-copy"><span className="routine-step-title">{step.title}{step.optional && <small>OPTIONAL</small>}</span><span>{step.instruction}</span>{(step.ownedName || step.product) && <strong className="routine-product-name">{step.owned ? 'On your shelf: ' : ''}{step.ownedName || step.product?.name}</strong>}{step.budgetNote && <small>{step.budgetNote}</small>}</span>
          <span className="routine-step-icon" aria-hidden="true"><ProductArt step={step.key} small /></span>
        </label>; })}</div>
        <div className="routine-footer"><ShieldCheck size={17} /><span>{plan.source === 'quiz' ? 'Based on your answers. No photo estimate.' : 'Based on your latest Skin Label.'} Introduce one new active at a time.</span></div>
      </section>
      <aside className="routine-aside">
        <section className="section-card week-card"><span className="eyebrow">YOUR LAST 7 DAYS</span><h3>{streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} of showing up.` : 'Every day is a fresh start.'}</h3><div className="week-dots">{days.map(day => { const active = hasActivity(day), isToday = day === today; return <div key={day} className={'week-day ' + (active ? 'checked ' : '') + (isToday ? 'today' : '')}><span className="mono">{new Intl.DateTimeFormat('en-IN', { weekday: 'narrow', timeZone: 'Asia/Kolkata' }).format(new Date(`${day}T12:00:00+05:30`))}</span><span className="week-dot" role="img" aria-label={`${prettyDate(`${day}T12:00:00+05:30`)}: ${active ? 'routine check-in saved' : 'no check-in'}`}>{active && <Check size={15} />}</span></div>; })}</div><p>A day counts when you tick at least one step. Missed a day? Just pick up where you are.</p></section>
        <section className="routine-tip"><Leaf size={24} strokeWidth={1.3} /><span className="eyebrow">A FRIENDLY REMINDER</span><h3>More is not always more.</h3><p>Give a simple routine time. You don’t need a new product for every concern.</p></section>
        <button className="routine-label-link" onClick={onLabel || goCheck}><span><span className="eyebrow">YOUR SKIN NOTES</span><strong>Revisit your label</strong></span><ArrowRight size={20} /></button>
      </aside>
    </div>
  </>;
}

export function Shelf({ state, products, refresh, notify }: SharedProps & { products: Product[] }) {
  const [open, setOpen] = useState(false), [mode, setMode] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState(''), [selected, setSelected] = useState<string>('');
  const [name, setName] = useState(''), [step, setStep] = useState<ProductStep>('cleanser'), [hasActive, setHasActive] = useState(true);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [removing, setRemoving] = useState(''), [error, setError] = useState('');
  const close = () => { if (!busy) { setOpen(false); setError(''); } };
  const modalRef = useDialog(open, close);
  const items = state?.shelf || [];
  const matches = products.filter(p => p.active && `${p.name} ${p.brand} ${p.ingredients.join(' ')}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  function startAdd() { setMode('search'); setQuery(''); setSelected(''); setName(''); setStep('cleanser'); setHasActive(true); setAgeConfirmed(false); setError(''); setOpen(true); }
  async function add(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const product = products.find(p => p.id === selected);
    if (mode === 'search' && !product) { setError('Choose a product, or add your own by name.'); return; }
    if (mode === 'custom' && name.trim().length < 2) { setError('Add the product name so you can recognise it later.'); return; }
    if (!state?.profile?.ageConfirmed && !ageConfirmed) { setError('Please confirm you are 18 or older before saving a product.'); return; }
    setBusy(true); setError('');
    try { if (!state?.profile?.ageConfirmed) await api('/api/profile', 'POST', { ageConfirmed: true }); await api('/api/shelf', 'POST', mode === 'search' && product ? { name: product.name, step: product.step, productId: product.id, hasActive: product.hasActive } : { name: name.trim(), step, hasActive: step === 'treatment' || hasActive }); await refresh(); setOpen(false); notify('Added to your shelf. Your routine will use what you already own.'); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  async function remove(item: ShelfItem) {
    if (removing) return; setRemoving(item.id); setError('');
    try { await api('/api/shelf', 'DELETE', { id: item.id }); await refresh(); notify('Removed from your shelf.'); }
    catch (err) { setError(errorMessage(err)); } finally { setRemoving(''); }
  }
  return <>
    <PageHead eyebrow="USE WHAT YOU HAVE" title="Your shelf. Less guesswork." text="Good skincare doesn’t start with a shopping list. Tell us what you already own."><button className="button" onClick={startAdd} disabled={!state}><Plus size={18} />Add a product</button></PageHead>
    <div className="shelf-note"><Leaf size={21} /><p>We use your shelf to avoid suggesting products for steps you already cover. Read your product’s directions and check that sunscreen is SPF 30+.</p></div>
    {error && !open && <p className="alert" role="alert">{error}</p>}
    {!state ? <div className="section-card workspace-loading" role="status"><LoaderCircle size={24} className="spin" />Opening your shelf…</div> : !items.length ? <Empty Icon={Droplets} title="A little room for your favourites." text="Add a cleanser, moisturiser or sunscreen you already use. We’ll build around them." action="Add my first product" onAction={startAdd} /> : <div className="shelf-grid">{items.map(item => <article className={'section-card shelf-item shelf-' + item.step} key={item.id}><div className="shelf-item-art"><span className="eyebrow">{STEPS[item.step]}</span><ProductArt step={item.step} /><button className="icon-button shelf-remove" disabled={!!removing} aria-label={`Remove ${item.name} from shelf`} onClick={() => void remove(item)}>{removing === item.id ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}</button></div><div className="shelf-item-copy"><h3>{item.name}</h3><span className="owned-tag"><Check size={13} />ALREADY YOURS</span>{item.hasActive && <p>Contains an active. We won’t suggest another new active.</p>}{item.step === 'sunscreen' && !item.productId && <p>Check your pack for broad-spectrum SPF 30+.</p>}</div></article>)}<button className="shelf-add-tile" onClick={startAdd}><Plus size={27} strokeWidth={1.3} /><span>Add another product</span></button></div>}
    {open && <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className="modal shelf-modal" role="dialog" aria-modal="true" aria-labelledby="shelf-dialog-title" ref={modalRef} tabIndex={-1}><button className="icon-button modal-close" aria-label="Close add product" onClick={close} disabled={busy}><X size={20} /></button><span className="eyebrow">MAKE YOURSELF AT HOME</span><h2 id="shelf-dialog-title">What’s on your shelf?</h2><p>Keep the useful things. Skip the duplicates.</p><div className="segmented" role="group" aria-label="How to add a product"><button className={mode === 'search' ? 'active' : ''} aria-pressed={mode === 'search'} onClick={() => { setMode('search'); setError(''); }}>Find a product</button><button className={mode === 'custom' ? 'active' : ''} aria-pressed={mode === 'custom'} onClick={() => { setMode('custom'); setError(''); }}>Add by name</button></div><form onSubmit={add}>
      {mode === 'search' ? <><label className="field-label" htmlFor="shelf-search">Search our catalogue</label><div className="search-field"><Search size={17} /><input id="shelf-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Brand, product or ingredient" autoComplete="off" /></div><div className="shelf-search-results" role="radiogroup" aria-label="Choose a product">{matches.length ? matches.map(product => <label className={'shelf-search-result ' + (selected === product.id ? 'selected' : '')} key={product.id}><input type="radio" name="shelf-product" value={product.id} checked={selected === product.id} onChange={() => setSelected(product.id)} /><span><strong>{product.name}</strong><small>{STEPS[product.step]} · {product.size}</small></span>{selected === product.id && <Check size={17} />}</label>) : <p className="search-empty">No match yet. Try a different name or use “Add by name”.</p>}</div></> : <><label className="field-label" htmlFor="shelf-name">Product name</label><input id="shelf-name" value={name} onChange={event => setName(event.target.value)} maxLength={120} required placeholder="For example, my gentle cleanser" /><label className="field-label" htmlFor="shelf-step">Which step does it cover?</label><select id="shelf-step" value={step} onChange={event => { setStep(event.target.value as ProductStep); if (event.target.value === 'treatment') setHasActive(true); }}>{Object.entries(STEPS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><label className="check-row"><input type="checkbox" checked={hasActive || step === 'treatment'} disabled={step === 'treatment'} onChange={event => setHasActive(event.target.checked)} /><span>Contains an active treatment ingredient<small>For example, exfoliating acids or a treatment serum. If unsure, leave this on to avoid adding another active.</small></span></label><p className="shelf-custom-note">We can’t verify a product added by name. Check the pack for fragrance, ingredients and pregnancy cautions.</p></>}
      {!state?.profile?.ageConfirmed && <label className="check-row"><input type="checkbox" checked={ageConfirmed} onChange={event => setAgeConfirmed(event.target.checked)} /><span>I am 18 or older<small>Tvacha is for adults. Confirm before saving products to your shelf.</small></span></label>}
      {error && <p className="alert" role="alert">{error}</p>}<button className="button full" type="submit" disabled={busy || (mode === 'search' && !selected) || (!state?.profile?.ageConfirmed && !ageConfirmed)}>{busy ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}{busy ? 'Saving to your shelf…' : 'Add to my shelf'}</button>
    </form></div></div>}
  </>;
}

export function Progress({ state, onSelect, goCheck, notify, refresh }: SharedProps & { onSelect: (s: Scan) => void; goCheck: () => void }) {
  const [deleting, setDeleting] = useState(''), [error, setError] = useState('');
  if (!state) return <div className="section-card workspace-loading" role="status"><LoaderCircle size={24} className="spin" />Opening your skin notes…</div>;
  const scans = [...state.scans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = scans[0], previous = scans[1];
  const comparison = newest?.analysis && previous?.analysis ? compareAnalyses(newest.analysis, previous.analysis) : null;
  const until = daysUntilRescan(newest?.createdAt || null);
  async function deletePhoto(photoId: string) {
    if (deleting) return; setDeleting(photoId); setError('');
    try { await api('/api/photos', 'DELETE', { id: photoId }); await refresh(); notify('Progress photo deleted.'); }
    catch (err) { setError(errorMessage(err)); } finally { setDeleting(''); }
  }
  return <>
    <PageHead eyebrow="NOTES, NOT SCORES" title="Your skin has a story." text="Look for patterns over time. Your skin is allowed to have different days."><button className="button" onClick={goCheck}><Camera size={18} />{newest ? 'Start a new check' : 'My first check'}</button></PageHead>
    {error && <p className="alert" role="alert">{error}</p>}
    {!newest ? <Empty Icon={Leaf} title="A fresh page for your skin." text="Your Skin Labels will live here. Start with a few quick questions and come back when you’re ready." action="Start my skin check" onAction={goCheck} /> : <>
      <div className="progress-overview"><div className="section-card progress-latest"><span className="eyebrow">YOUR LATEST LABEL</span><SkinLabel scan={newest} compact /><button className="button secondary full" onClick={() => onSelect(newest)}>Open this label<ArrowRight size={17} /></button></div><section className="section-card comparison-card"><span className="eyebrow">A LITTLE PERSPECTIVE</span><h2>{previous ? 'Then, and now.' : 'One label. A starting point.'}</h2><p>{previous ? `${prettyDate(previous.createdAt)} → ${prettyDate(newest.createdAt)}` : 'A second label will help you compare observations. There’s no rush.'}</p>{previous ? <div className="comparison-list">{CONCERN_KEYS.map(key => { const result = comparison?.find(c => c.key === key)?.change || 'not sure'; const Icon = result === 'better' ? ArrowDown : result === 'worse' ? ArrowUp : result === 'same' ? ArrowRight : Circle; return <div className={'comparison-row change-' + result.replace(' ', '-')} key={key}><span className="concern-code" style={{ background: CONCERN_META[key].color }}>{CONCERN_META[key].code}</span><strong>{CONCERN_META[key].name}</strong><span><Icon size={14} />{result === 'better' ? 'Less visible' : result === 'worse' ? 'More visible' : result === 'same' ? 'Similar' : 'Not sure'}</span></div>; })}</div> : <div className="comparison-empty"><Leaf size={36} strokeWidth={1.2} /><span>Some things take a little time.</span></div>}<div className="progress-light-note"><Sun size={17} /><p>Light and camera change results. This is a comparison of cosmetic photo estimates, not a measure of skin health.{!comparison && previous ? ' Both labels need usable photo estimates to compare.' : ''}</p></div></section></div>
      <section className="weekly-rescan"><div className="weekly-rescan-icon"><Camera size={23} /></div><div><span className="eyebrow">THE WEEKLY CHECK-IN</span><h3>{until === 0 ? 'Time for this week’s label.' : `A little space between labels. ${until} day${until === 1 ? '' : 's'} to your weekly check-in.`}</h3><p>Same spot. Same light. No filter. It makes your notes easier to compare.</p></div><button className="button secondary" onClick={goCheck}>{until === 0 ? 'Take my next check' : 'Open skin check'}<ArrowRight size={17} /></button></section>
      <section className="label-history"><div className="section-heading"><div><span className="eyebrow">YOUR PAPER TRAIL</span><h2>Past labels.</h2></div><span className="mono">{scans.length} SAVED</span></div><div className="history-list">{scans.map((scan, index) => <button className="history-item" key={scan.id} onClick={() => onSelect(scan)}><div className="history-date"><span className="mono">{String(scans.length - index).padStart(2, '0')}</span><strong>{prettyDate(scan.createdAt)}</strong><small>{scan.source === 'photo' ? 'Photo estimate' : 'Quiz-based routine'}</small></div><div className="history-swatches" aria-label={scan.source === 'photo' ? 'Concern observations saved' : 'Quiz-only, no concern scores'}>{CONCERN_KEYS.map(key => { const concern = scan.analysis?.concerns.find(c => c.key === key); return <span key={key} style={{ background: concern ? CONCERN_META[key].color : '#E9F1EE', color: concern ? '#FFFFFF' : '#46595D', opacity: concern && concern.level === 0 ? .6 : 1 }} title={`${CONCERN_META[key].name}: ${concern ? `level ${concern.level}, ${concern.confidence} confidence` : 'not measured'}`}>{CONCERN_META[key].code}</span>; })}</div><ChevronRight size={18} /></button>)}</div></section>
    </>}
    {!!state.photos.length && <section className="progress-photos"><div className="section-heading"><div><span className="eyebrow">SAVED BY YOUR CHOICE</span><h2>Your progress photos.</h2></div><span className="private-tag"><ShieldCheck size={14} />ONLY YOU</span></div><p>Stored privately with your separate consent. You can delete a photo at any time, or withdraw photo consent in settings.</p><div className="photo-grid">{state.photos.map(photo => <article className="progress-photo" key={photo.id}><a href={`/api/photos?id=${encodeURIComponent(photo.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open progress photo from ${prettyDate(photo.createdAt)}`}><img loading="lazy" src={`/api/photos?id=${encodeURIComponent(photo.id)}`} alt={`Your saved progress photo, ${prettyDate(photo.createdAt)}`} /></a><div><span className="mono">{prettyDate(photo.createdAt)}</span><button className="icon-button" aria-label={`Delete progress photo from ${prettyDate(photo.createdAt)}`} disabled={!!deleting} onClick={() => void deletePhoto(photo.id)}>{deleting === photo.id ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}</button></div></article>)}</div></section>}
  </>;
}

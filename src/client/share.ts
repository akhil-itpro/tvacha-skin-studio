import type { RoutinePlan, SkinAnalysis } from '../domain/types';
import { wrapLines } from './text-layout';

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type ShareableScan = { id: string; createdAt: string; analysis: SkinAnalysis | null };
const CONCERNS = [
  ['shine', 'S', 'Shine', '#B17A3B'], ['breakouts', 'B', 'Breakouts', '#E01C7D'],
  ['dark_spots', 'D', 'Uneven tone', '#7D540E'], ['redness', 'R', 'Redness', '#750E15'],
  ['dryness', 'Y', 'Dryness', '#1670E3'], ['under_eye', 'U', 'Under-eye', '#3E266C'],
] as const;

/** Produces a label-only image. This function never accepts or reads a face photo. */
export async function shareLabel(scan: ShareableScan, plan: RoutinePlan): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (plan.stopped) throw new Error('A stopped skin check cannot be shared as a routine.');
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot create a share image.');
  await document.fonts?.ready;
  ctx.fillStyle = '#E9F1EE'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(54, 54, 972, 1242);
  ctx.strokeStyle = '#C9D8D3'; ctx.lineWidth = 2; ctx.strokeRect(54, 54, 972, 1242);
  function text(value: string, x: number, y: number, size = 26, color = '#12262B', family = '"Atkinson Hyperlegible Next", sans-serif', weight = 400) {
    ctx!.fillStyle = color; ctx!.font = `${weight} ${size}px ${family}`; ctx!.fillText(value, x, y);
  }
  function wrap(value: string, x: number, y: number, maxWidth: number, size = 25, lineHeight = 34, maxLines = 3): number {
    ctx!.font = `${size}px "Atkinson Hyperlegible Next", sans-serif`;
    const lines = wrapLines(value, maxWidth, maxLines, value => ctx!.measureText(value).width);
    for (const line of lines) { text(line, x, y, size); y += lineHeight; }
    return y;
  }
  text('tvacha', 104, 134, 55, '#1F6B63', 'Archivo, sans-serif', 700);
  text('YOUR SKIN LABEL', 104, 195, 23, '#46595D', '"IBM Plex Mono", monospace');
  const parsed = new Date(scan.createdAt);
  const date = Number.isNaN(parsed.getTime()) ? 'UNDATED' : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  text(`BATCH ${date.toUpperCase()} / ${scan.id.slice(0, 6).toUpperCase()}`, 104, 238, 21, '#46595D', '"IBM Plex Mono", monospace');
  ctx.strokeStyle = '#C9D8D3'; ctx.beginPath(); ctx.moveTo(104, 266); ctx.lineTo(976, 266); ctx.stroke();
  if (scan.analysis) {
    CONCERNS.forEach(([key, code, label, color], index) => {
      const y = 312 + index * 65; const concern = scan.analysis!.concerns.find(item => item.key === key);
      ctx.fillStyle = color; ctx.fillRect(104, y - 26, 36, 36);
      text(code, 114, y, 23, key === 'shine' ? '#000000' : '#FFFFFF', '"IBM Plex Mono", monospace', 700);
      text(label, 161, y, 27);
      for (let n = 0; n < 3; n++) { ctx.fillStyle = concern && n < concern.level ? color : '#E9F1EE'; ctx.fillRect(540 + n * 67, y - 22, 53, 18); }
      text(concern ? `${concern.confidence === 'medium' ? 'MED' : concern.confidence.toUpperCase()} SURE` : 'NOT READ', 765, y, 18, '#46595D', '"IBM Plex Mono", monospace');
    });
  } else {
    text('A routine from my answers.', 104, 330, 38, '#12262B', 'Archivo, sans-serif', 700);
    wrap('Quiz-only guidance. No photo analysis or concern scores.', 104, 390, 820, 29);
    CONCERNS.forEach(([key, code, , color], index) => { ctx.fillStyle = color; ctx.fillRect(104 + index * 66, 480, 50, 50); text(code, 120 + index * 66, 515, 28, key === 'shine' ? '#000000' : '#FFFFFF', '"IBM Plex Mono", monospace', 700); });
  }
  text('WHAT I’M FOCUSING ON', 104, 741, 21, '#46595D', '"IBM Plex Mono", monospace');
  wrap(plan.focusAreas.map(item => item.title).join(' · ') || 'A simple, consistent routine', 104, 790, 825, 32, 40, 2);
  text('AM', 104, 911, 26, '#1F6B63', '"IBM Plex Mono", monospace', 700);
  wrap(plan.am.map(step => step.title).join(' → '), 178, 911, 760, 25, 34, 2);
  text('PM', 104, 1017, 26, '#1F6B63', '"IBM Plex Mono", monospace', 700);
  wrap(plan.pm.map(step => step.title).join(' → '), 178, 1017, 760, 25, 34, 2);
  ctx.strokeStyle = '#C9D8D3'; ctx.beginPath(); ctx.moveTo(104, 1123); ctx.lineTo(976, 1123); ctx.stroke();
  text('Cosmetic guidance. Not a diagnosis.', 104, 1175, 24, '#46595D');
  text('Light and camera change results. Your skin is not a score.', 104, 1221, 21, '#46595D');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create your share image.')), 'image/png'));
  const file = new File([blob], `tvacha-label-${scan.id.slice(0, 8)}.png`, { type: 'image/png' });
  // Invoke the share sheet immediately after generation if the platform supports image files.
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: 'My Tvacha Skin Label', files: [file] }); return 'shared'; }
    catch (error) { if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'; }
  }
  downloadBlob(blob, file.name);
  return 'downloaded';
}

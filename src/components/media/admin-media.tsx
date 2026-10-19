'use client';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AnalyticsParticipant } from '@/lib/analytics';
import type { Competition } from '@/lib/competition-domain';
import type { PrizeSettings } from '@/lib/prizes';
import type { InsightsData } from '@/lib/analytics-insights';
import type { MediaPost } from '@/lib/media-log';
import { posterFormat, posterFormats, type FormatId } from '@/lib/media/formats';
import {
  countOf,
  DOWNLOADS,
  freshness,
  mediaFacts,
  POSTS,
  type MediaFacts,
} from '@/lib/media/facts';
import { chartKinds, type ChartKind, type PosterRequest } from '@/lib/media/charts';
import {
  displayLink,
  linkTargets,
  newPostCode,
  siteBase,
  type LinkTarget,
} from '@/lib/media/codes';
import { qrMatrix, qrPaths, qrStyles, type QrStyle } from '@/lib/media/qr';
import { cleanSource } from '@/lib/analytics-insights';
import { api, Icon } from '../ui';
import { loadPosterFonts } from './fonts';
import { clearFitCache } from './text-fit';
import { identities, type Identity, type Tone } from './poster-kit';
import {
  hashtags,
  templateById,
  templateGroups,
  templates,
  type PosterTemplate,
  type TemplateOptions,
} from './templates';
import { PosterView, posterLink, posterTexts, type Draft } from './poster-view';
import { download, rasterize, verifyQr, zip, type ImageType } from './export';

type Store = { identity: Identity; format: FormatId; drafts: Record<string, Draft> };
const STORE_KEY = 'nbc-media-v1';
function readStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as Partial<Store> | null;
    if (raw && typeof raw === 'object')
      return {
        identity: identities.some((i) => i.id === raw.identity) ? raw.identity! : 'original',
        format: posterFormats.some((f) => f.id === raw.format) ? raw.format! : 'square',
        drafts: raw.drafts && typeof raw.drafts === 'object' ? raw.drafts : {},
      };
  } catch {
    // Storage may be unavailable; the studio still works for this visit.
  }
  return { identity: 'original', format: 'square', drafts: {} };
}
function newDraft(t: PosterTemplate, code = newPostCode(t.id)): Draft {
  return {
    texts: {},
    qrOn: true,
    qrStyle: 'mihrab',
    target: t.target,
    code,
    stamp: true,
    chart: 'cities',
    school: 0,
  };
}
type Entry = { key: string; template: PosterTemplate; chart?: ChartKind };
type View = 'gallery' | 'editor' | 'log';
type Toast = { text: string; tone: 'ok' | 'warn' } | null;
type Checked = { ok: boolean | null; at: number } | null;

export function AdminMedia({
  participants,
  competition,
  prizes,
  request,
  onRequestDone,
  preview = null,
}: {
  participants: AnalyticsParticipant[];
  competition?: Competition;
  prizes?: PrizeSettings;
  request: PosterRequest | null;
  onRequestDone: () => void;
  // Rows of a running simulation: shown on demand, watermarked and never exported.
  preview?: AnalyticsParticipant[] | null;
}) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<Store>(readStore);
  const [view, setView] = useState<View>('gallery');
  const [current, setCurrent] = useState('gate');
  const [source, setSource] = useState<{ people: AnalyticsParticipant[]; scope: string } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [frozen, setFrozen] = useState<MediaFacts | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [base, setBase] = useState('https://nbc-web-two.vercel.app');
  const [simulated, setSimulated] = useState(false);
  const previewing = simulated && !!preview;
  const people = previewing ? preview! : participants;
  // One code per template for this visit, kept once the template is edited or exported.
  const [codes] = useState(() =>
    Object.fromEntries(templates.map((t) => [t.id, newPostCode(t.id)])),
  );

  useEffect(() => {
    let alive = true;
    void loadPosterFonts().then(() => {
      clearFitCache();
      if (alive) setReady(true);
    });
    setBase(siteBase(window.location.origin));
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      // Drafts are a convenience; losing them is acceptable.
    }
  }, [store]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const live = useMemo(
    () => mediaFacts({ people, competition, prizes, now }),
    [people, competition, prizes, now],
  );
  const F = frozen ?? live;
  const format = posterFormat(store.format);
  const draftOf = (id: string): Draft => ({
    ...newDraft(templateById(id), codes[id]),
    ...store.drafts[id],
  });
  const setDraft = (id: string, change: Partial<Draft>) =>
    setStore((s) => ({
      ...s,
      drafts: { ...s.drafts, [id]: { ...draftOf(id), ...s.drafts[id], ...change } },
    }));

  // A chart sent from the analytics page opens straight in the editor, with its filters.
  useEffect(() => {
    if (!request) return;
    setSource({ people: request.people, scope: request.scope });
    setStore((s) => ({
      ...s,
      drafts: {
        ...s.drafts,
        chart: {
          ...newDraft(templateById('chart'), codes.chart),
          ...s.drafts.chart,
          chart: request.chart,
          texts: {},
          code: newPostCode(`chart-${request.chart}`),
        },
      },
    }));
    setCurrent('chart');
    setView('editor');
    onRequestDone();
  }, [request, onRequestDone, codes]);

  const options = (t: PosterTemplate, d: Draft, chart?: ChartKind): TemplateOptions => ({
    chart: chart ?? d.chart,
    school: d.school,
    people: t.id === 'chart' && source && !previewing ? source.people : people,
    scope: t.id === 'chart' && source ? source.scope : '',
  });
  const entries: Entry[] = templates.flatMap((t) =>
    t.id === 'chart'
      ? chartKinds.map((c) => ({ key: `chart-${c.id}`, template: t, chart: c.id }))
      : [{ key: t.id, template: t }],
  );

  function open(entry: Entry) {
    if (entry.chart) {
      const d = draftOf('chart');
      setSource(null);
      if (d.chart !== entry.chart)
        setDraft('chart', {
          chart: entry.chart,
          texts: {},
          code: newPostCode(`chart-${entry.chart}`),
        });
    }
    setCurrent(entry.template.id);
    setView('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!ready)
    return (
      <div className="media-loading" role="status">
        <span className="media-loading-mark" aria-hidden="true" />
        جارٍ تحميل خطوط المنشورات…
      </div>
    );

  return (
    <div className="media-studio">
      <div className="media-bar">
        <div className="media-views" role="tablist" aria-label="أقسام المركز الإعلامي">
          {(
            [
              ['gallery', 'القوالب', `${entries.length}`],
              ['editor', 'المحرر', ''],
              ['log', 'سجل المنشورات', ''],
            ] as const
          ).map(([id, name, badge]) => (
            <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>
              {name}
              {badge && <small>{badge}</small>}
            </button>
          ))}
        </div>
        {view !== 'log' && (
          <>
            <FormatPicker
              value={store.format}
              onChange={(f) => setStore((s) => ({ ...s, format: f }))}
            />
            <IdentityPicker
              value={store.identity}
              onChange={(i) => setStore((s) => ({ ...s, identity: i }))}
            />
          </>
        )}
        {preview && (
          <label className="media-switch media-sim">
            <input
              type="checkbox"
              checked={simulated}
              onChange={(e) => setSimulated(e.target.checked)}
            />
            <span aria-hidden="true" />
            معاينة ببيانات المحاكاة
          </label>
        )}
        <span
          className={`media-live${frozen ? ' frozen' : ''}${previewing ? ' simulated' : ''}`}
          title={freshness(F.asOf)}
        >
          <i aria-hidden="true" />
          {previewing ? 'بيانات محاكاة' : frozen ? 'الأرقام مجمّدة' : 'بيانات حيّة'}
        </span>
      </div>

      {view === 'gallery' && (
        <Gallery
          entries={entries}
          draftOf={draftOf}
          options={options}
          F={F}
          base={base}
          identity={store.identity}
          formatId={store.format}
          onOpen={open}
          watermark={previewing}
        />
      )}
      {view === 'editor' && (
        <Editor
          key={current}
          template={templateById(current)}
          draft={draftOf(current)}
          setDraft={(c) => setDraft(current, c)}
          options={options(templateById(current), draftOf(current))}
          F={F}
          frozen={!!frozen}
          onFreeze={(on) => setFrozen(on ? live : null)}
          base={base}
          identity={store.identity}
          formatId={store.format}
          onFormat={(f) => setStore((s) => ({ ...s, format: f }))}
          onSwitch={(id) => setCurrent(id)}
          source={current === 'chart' ? source : null}
          onClearSource={() => setSource(null)}
          onBack={() => setView('gallery')}
          toast={setToast}
          simulated={previewing}
        />
      )}
      {view === 'log' && (
        <PostLog
          participants={participants}
          onOpen={(post) => {
            const t = templateById(post.template);
            const [identity, tone, qrStyle] = post.style.split('/');
            setStore((s) => ({
              ...s,
              identity: identities.some((i) => i.id === identity)
                ? (identity as Identity)
                : s.identity,
              drafts: {
                ...s.drafts,
                [t.id]: {
                  ...draftOf(t.id),
                  texts: post.texts ?? {},
                  code: post.code,
                  target: (linkTargets.some((l) => l.id === post.target)
                    ? post.target
                    : t.target) as LinkTarget,
                  tone: tone === 'dark' || tone === 'light' ? tone : undefined,
                  qrStyle: qrStyles.some((q) => q.id === qrStyle) ? (qrStyle as QrStyle) : 'mihrab',
                  qrOn: post.target !== 'none' && !!post.link.includes('ref='),
                },
              },
            }));
            setCurrent(t.id);
            setView('editor');
          }}
          toast={setToast}
        />
      )}
      {toast && (
        <div className={`media-toast ${toast.tone}`} role="status">
          <Icon name={toast.tone === 'ok' ? 'check' : 'warn'} size={18} />
          {toast.text}
        </div>
      )}
    </div>
  );
}

function FormatPicker({ value, onChange }: { value: FormatId; onChange: (f: FormatId) => void }) {
  return (
    <div className="media-formats" role="radiogroup" aria-label="مقاس المنشور">
      {posterFormats.map((f) => (
        <button
          key={f.id}
          role="radio"
          aria-checked={value === f.id}
          onClick={() => onChange(f.id)}
          title={`${f.w}×${f.h} · ${f.platforms}`}
        >
          <i style={{ '--ar': `${f.w} / ${f.h}` } as CSSProperties} aria-hidden="true" />
          <span>
            {f.name}
            <small>{f.ratio}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
function IdentityPicker({ value, onChange }: { value: Identity; onChange: (i: Identity) => void }) {
  return (
    <div className="media-identities" role="radiogroup" aria-label="هوية المنشور">
      {identities.map((i) => (
        <button
          key={i.id}
          role="radio"
          aria-checked={value === i.id}
          onClick={() => onChange(i.id)}
        >
          <i style={{ background: i.swatch[0] }} aria-hidden="true">
            <b style={{ background: i.swatch[1] }} />
          </i>
          {i.name}
        </button>
      ))}
    </div>
  );
}

function Gallery({
  entries,
  draftOf,
  options,
  F,
  base,
  identity,
  formatId,
  onOpen,
  watermark,
}: {
  entries: Entry[];
  draftOf: (id: string) => Draft;
  options: (t: PosterTemplate, d: Draft, chart?: ChartKind) => TemplateOptions;
  F: MediaFacts;
  base: string;
  identity: Identity;
  formatId: FormatId;
  onOpen: (e: Entry) => void;
  watermark: boolean;
}) {
  const format = posterFormat(formatId);
  return (
    <div className="media-gallery" data-shape={format.shape}>
      {templateGroups.map((g) => {
        const list = entries.filter((e) => e.template.group === g.id);
        return (
          <section key={g.id} className="media-group" aria-labelledby={`media-group-${g.id}`}>
            <header>
              <span className="media-star" aria-hidden="true" />
              <h2 id={`media-group-${g.id}`}>{g.name}</h2>
              <p>{g.note}</p>
              <small>{list.length.toLocaleString('ar-SA')}</small>
            </header>
            <div className="media-grid">
              {list.map((e, i) => {
                const d = draftOf(e.template.id);
                const draft = e.chart
                  ? { ...d, chart: e.chart, texts: d.chart === e.chart ? d.texts : {} }
                  : d;
                const name = e.chart
                  ? chartKinds.find((c) => c.id === e.chart)!.name
                  : e.template.name;
                return (
                  <button
                    key={e.key}
                    className="media-card"
                    style={{ '--i': i } as CSSProperties}
                    onClick={() => onOpen(e)}
                    aria-label={`تحرير: ${name}`}
                  >
                    <span className="media-card-shell">
                      <span className="media-card-core">
                        <PosterView
                          template={e.template}
                          draft={{ ...draft, code: 'm-preview' }}
                          format={format}
                          identity={identity}
                          facts={F}
                          options={options(e.template, draft, e.chart)}
                          base={base}
                          watermark={watermark}
                        />
                      </span>
                    </span>
                    <span className="media-card-meta">
                      <strong>{name}</strong>
                      <span>{e.chart ? 'رسم من التحليلات' : e.template.blurb}</span>
                      {e.template.live && <em>حيّ</em>}
                    </span>
                    <span className="media-card-go" aria-hidden="true">
                      تحرير
                      <i>
                        <Icon size={14} />
                      </i>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const PLATFORMS = [
  { id: 'x', name: 'إكس' },
  { id: 'instagram', name: 'إنستغرام' },
  { id: 'whatsapp', name: 'واتساب' },
] as const;
function captionFor(
  platform: (typeof PLATFORMS)[number]['id'],
  body: string,
  T: Record<string, string>,
  link: string,
) {
  if (platform === 'whatsapp')
    return `*${T.title ?? T.kicker ?? ''}*\n${body}\n${T.cta ?? ''}\n${link}`.trim();
  if (platform === 'instagram')
    return `${body}\n\n${T.cta ?? ''}\nالرابط: ${displayLink(link)}\n\n${hashtags}`.trim();
  const full = `${body}\n${link}\n${hashtags}`;
  if (full.length <= 280) return full;
  const short = `${body}\n${link}`;
  return short.length <= 280 ? short : `${body.slice(0, 280 - link.length - 3)}…\n${link}`;
}

function Editor({
  template: t,
  draft,
  setDraft,
  options,
  F,
  frozen,
  onFreeze,
  base,
  identity,
  formatId,
  onFormat,
  onSwitch,
  source,
  onClearSource,
  onBack,
  toast,
  simulated,
}: {
  template: PosterTemplate;
  draft: Draft;
  setDraft: (c: Partial<Draft>) => void;
  options: TemplateOptions;
  F: MediaFacts;
  frozen: boolean;
  onFreeze: (on: boolean) => void;
  base: string;
  identity: Identity;
  formatId: FormatId;
  onFormat: (f: FormatId) => void;
  onSwitch: (id: string) => void;
  source: { people: AnalyticsParticipant[]; scope: string } | null;
  onClearSource: () => void;
  onBack: () => void;
  toast: (t: Toast) => void;
  simulated: boolean;
}) {
  const format = posterFormat(formatId);
  const stage = useRef<HTMLDivElement>(null);
  const rack = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<{
    key: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [safe, setSafe] = useState(true);
  const [type, setType] = useState<ImageType>('png');
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState('');
  const [bundle, setBundle] = useState(false);
  const [checked, setChecked] = useState<Checked>(null);
  const [overflow, setOverflow] = useState(false);
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]['id']>('x');
  const { texts: T, defaults } = posterTexts(t, draft, F, options);
  const link = posterLink(base, draft);
  const tone: Tone = draft.tone ?? t.tone;
  const caption = captionFor(platform, t.caption(F, T, options), T, link);
  const editable = new Set(t.slots.map((s) => s.key));
  const keyOf = (s: string) => s.replace(/^s(\d)-text$/, 'd$1');

  useEffect(() => {
    // Overflowing text is marked on the poster itself; read it after each render.
    const svg = stage.current?.querySelector('svg[data-poster]');
    setOverflow(!!svg?.querySelector('[data-overflow]'));
  });
  useEffect(() => setChecked(null), [link, draft.qrStyle, draft.qrOn, formatId, identity, tone]);
  useEffect(() => {
    if (!slot) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setSlot(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [slot]);

  function pick(e: React.MouseEvent) {
    const target = (e.target as Element).closest('[data-slot]');
    const key = target ? keyOf(target.getAttribute('data-slot') ?? '') : '';
    if (!target || !editable.has(key) || !stage.current) {
      setSlot(null);
      return;
    }
    const box = target.getBoundingClientRect();
    const host = stage.current.getBoundingClientRect();
    setSlot({
      key,
      top: box.bottom - host.top + 10,
      left: Math.min(Math.max(12, box.left - host.left + box.width / 2 - 170), host.width - 352),
      width: box.width,
    });
  }
  const facts = t.facts?.(F, options) ?? {};
  async function record(fmt: string) {
    try {
      await api('admin/media', {
        action: 'record',
        code: draft.code,
        template: t.id,
        title: (T.title || T.value || t.name).slice(0, 120),
        format: fmt,
        target: draft.target,
        link,
        facts,
        texts: draft.texts,
        style: `${identity}/${tone}/${draft.qrStyle}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  const fileBase = `nbc-${t.id}${t.id === 'chart' ? `-${draft.chart}` : ''}-${draft.qrOn ? draft.code : 'post'}`;
  async function exportOne() {
    const svg = stage.current?.querySelector<SVGSVGElement>('svg[data-poster]');
    if (!svg) return;
    setBusy('one');
    try {
      const { blob, canvas } = await rasterize(svg, { scale, type });
      const ok = draft.qrOn ? await verifyQr(svg, canvas, scale, link) : null;
      setChecked({ ok, at: Date.now() });
      download(blob, `${fileBase}-${format.id}.${type === 'png' ? 'png' : 'jpg'}`);
      const logged = await record(format.id);
      toast(
        ok === false
          ? {
              text: 'تم التنزيل، لكن تعذّرت قراءة الرمز. جرّب نمطًا آخر أو مقاسًا أكبر.',
              tone: 'warn',
            }
          : logged
            ? { text: `تم تنزيل ${format.name} ${format.ratio} وتسجيله في السجل.`, tone: 'ok' }
            : { text: 'تم التنزيل، ولم يُسجّل المنشور في السجل.', tone: 'warn' },
      );
    } catch {
      toast({ text: 'تعذّر إنشاء الصورة. أعد المحاولة.', tone: 'warn' });
    } finally {
      setBusy('');
    }
  }
  async function exportAll() {
    setBundle(true);
    setBusy('all');
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const svgs = [...(rack.current?.querySelectorAll<SVGSVGElement>('svg[data-poster]') ?? [])];
      const files: { name: string; data: Blob | string }[] = [];
      let bad = 0;
      for (const [i, svg] of svgs.entries()) {
        const f = posterFormats[i];
        const { blob, canvas } = await rasterize(svg, { scale, type });
        if (draft.qrOn && (await verifyQr(svg, canvas, scale, link)) === false) bad++;
        files.push({
          name: `${fileBase}-${f.id}-${f.w}x${f.h}.${type === 'png' ? 'png' : 'jpg'}`,
          data: blob,
        });
      }
      files.push({
        name: 'caption.txt',
        data: PLATFORMS.map(
          (p) => `— ${p.name} —\n${captionFor(p.id, t.caption(F, T, options), T, link)}`,
        ).join('\n\n'),
      });
      download(await zip(files), `${fileBase}.zip`);
      setChecked({ ok: draft.qrOn ? bad === 0 : null, at: Date.now() });
      const logged = await record('bundle');
      toast(
        bad
          ? {
              text: `تم تنزيل الحزمة، لكن الرمز لم يُقرأ في ${bad.toLocaleString('ar-SA')} مقاس.`,
              tone: 'warn',
            }
          : {
              text: logged
                ? 'تم تنزيل حزمة المقاسات الخمسة وتسجيلها.'
                : 'تم تنزيل الحزمة، ولم تُسجّل في السجل.',
              tone: logged ? 'ok' : 'warn',
            },
      );
    } catch {
      toast({ text: 'تعذّر إنشاء الحزمة. أعد المحاولة.', tone: 'warn' });
    } finally {
      setBundle(false);
      setBusy('');
    }
  }
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ text: `تم نسخ ${what}.`, tone: 'ok' });
    } catch {
      toast({ text: 'تعذّر النسخ من المتصفح.', tone: 'warn' });
    }
  }

  const checks = [
    ...(t.checks?.(F, options, T) ?? []),
    { label: 'النص يتسع في مساحته', ok: !overflow, note: 'اختصر النص المظلل حتى يتسع.' },
    ...(draft.qrOn
      ? [
          {
            label: 'الرمز يُقرأ من الصورة',
            ok: checked?.ok ?? null,
            note: checked ? 'جرّب نمط «كلاسيكي» أو مقاس ٢×.' : 'يُفحص عند التنزيل.',
          },
        ]
      : []),
    ...(t.live
      ? [
          {
            label: 'ختم وقت الأرقام',
            ok: draft.stamp,
            note: 'الأرقام بلا تاريخ قد تُفهم خطأ لاحقًا.',
          },
        ]
      : []),
    { label: 'لا يظهر رقم أقل من ٥ ولا اسم مشارك', ok: true, note: '' },
  ];
  const chartName = chartKinds.find((c) => c.id === draft.chart)?.name;

  return (
    <div className="media-editor">
      <div className="media-stage-col">
        <div className="media-stage-bar">
          <button className="media-back" onClick={onBack}>
            <span aria-hidden="true">→</span> كل القوالب
          </button>
          <label className="media-template-select">
            <span className="sr-only">القالب</span>
            <select value={t.id} onChange={(e) => onSwitch(e.target.value)}>
              {templateGroups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {templates
                    .filter((x) => x.group === g.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="media-seg" role="radiogroup" aria-label="درجة الخلفية">
            {(
              [
                ['dark', 'داكن'],
                ['light', 'فاتح'],
              ] as const
            ).map(([v, n]) => (
              <button
                key={v}
                role="radio"
                aria-checked={tone === v}
                onClick={() => setDraft({ tone: v })}
              >
                {n}
              </button>
            ))}
          </div>
          {format.safe && (
            <label className="media-check">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
              مناطق واجهة القصص
            </label>
          )}
        </div>
        <div className="media-stage" data-shape={format.shape}>
          <div
            className="media-stage-poster"
            ref={stage}
            onClick={pick}
            style={{ '--ar': `${format.w} / ${format.h}` } as CSSProperties}
          >
            <PosterView
              template={t}
              draft={draft}
              format={format}
              identity={identity}
              facts={F}
              options={options}
              base={base}
              editable
              watermark={simulated}
            />
            {format.safe && safe && (
              <>
                <span
                  className="media-safe top"
                  style={{ height: `${(format.safe.top / format.h) * 100}%` }}
                >
                  تغطيه واجهة القصص
                </span>
                <span
                  className="media-safe bottom"
                  style={{ height: `${(format.safe.bottom / format.h) * 100}%` }}
                >
                  تغطيه واجهة القصص
                </span>
              </>
            )}
            {slot && (
              <div
                className="media-pop"
                style={{ top: slot.top, left: slot.left }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="media-pop-head">
                  <strong>{t.slots.find((s) => s.key === slot.key)?.label}</strong>
                  <button className="media-icon" aria-label="إغلاق" onClick={() => setSlot(null)}>
                    <Icon name="close" size={16} />
                  </button>
                </div>
                <textarea
                  autoFocus
                  dir="rtl"
                  rows={3}
                  value={T[slot.key] ?? ''}
                  onChange={(e) =>
                    setDraft({ texts: { ...draft.texts, [slot.key]: e.target.value } })
                  }
                />
                <div className="media-pop-foot">
                  <span>{overflow ? 'أطول من مساحته · اختصره' : 'يتسع تلقائيًا في مساحته'}</span>
                  {slot.key in draft.texts && (
                    <button
                      className="text-link"
                      onClick={() => {
                        const { [slot.key]: _, ...rest } = draft.texts;
                        void _;
                        setDraft({ texts: rest });
                      }}
                    >
                      استعادة النص
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="media-stage-hint">
          <Icon name="info" size={16} /> اضغط أي نص في المنشور لتعديله. {format.w}×{format.h} بكسل ·{' '}
          {format.platforms}
        </p>
        <FormatPicker value={formatId} onChange={onFormat} />
      </div>

      <aside className="media-inspector" aria-label="خصائص المنشور">
        <section className="media-panel media-head-panel">
          <span className="media-eyebrow">
            {templateGroups.find((g) => g.id === t.group)?.name}
          </span>
          <h2>{t.id === 'chart' ? chartName : t.name}</h2>
          <p>{t.blurb}</p>
        </section>

        <section className="media-panel">
          <h3>النص</h3>
          {t.slots.map((s) => {
            const changed = s.key in draft.texts;
            return (
              <label key={s.key} className="media-field">
                <span>
                  {s.label}
                  {changed && (
                    <button
                      type="button"
                      className="media-reset"
                      onClick={(e) => {
                        e.preventDefault();
                        const { [s.key]: _, ...rest } = draft.texts;
                        void _;
                        setDraft({ texts: rest });
                      }}
                    >
                      معدّل · استعادة
                    </button>
                  )}
                </span>
                {s.long ? (
                  <textarea
                    dir="rtl"
                    rows={3}
                    value={T[s.key] ?? ''}
                    placeholder={defaults[s.key]}
                    onChange={(e) =>
                      setDraft({ texts: { ...draft.texts, [s.key]: e.target.value } })
                    }
                  />
                ) : (
                  <input
                    dir="rtl"
                    value={T[s.key] ?? ''}
                    placeholder={defaults[s.key]}
                    onChange={(e) =>
                      setDraft({ texts: { ...draft.texts, [s.key]: e.target.value } })
                    }
                  />
                )}
              </label>
            );
          })}
        </section>

        {(t.live || t.id === 'chart' || t.id === 'school') && (
          <section className="media-panel">
            <h3>البيانات</h3>
            {t.id === 'chart' && (
              <label className="media-field">
                <span>الرسم</span>
                <select
                  value={draft.chart}
                  onChange={(e) => setDraft({ chart: e.target.value as ChartKind, texts: {} })}
                >
                  {chartKinds.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {t.id === 'chart' && source && (
              <p className="media-scope">
                <Icon name="chart" size={16} /> من التحليلات: {source.scope || 'كل المشاركين'} ·{' '}
                {source.people.length.toLocaleString('ar-SA')} سجلًا
                <button className="text-link" onClick={onClearSource}>
                  استخدم كل المشاركين
                </button>
              </p>
            )}
            {t.id === 'school' && (
              <label className="media-field">
                <span>الجهة التعليمية</span>
                <select
                  value={draft.school}
                  onChange={(e) => setDraft({ school: Number(e.target.value), texts: {} })}
                >
                  {F.schools.length ? (
                    F.schools.map((s, i) => (
                      <option key={s.name + s.city} value={i}>
                        {s.name} · {s.city} ({s.total.toLocaleString('ar-SA')})
                      </option>
                    ))
                  ) : (
                    <option value={0}>لا توجد جهة بعشرة مشاركين بعد</option>
                  )}
                </select>
              </label>
            )}
            {Object.keys(facts).length > 0 && (
              <dl className="media-facts">
                {Object.entries(facts).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            <p className="media-fresh">{freshness(F.asOf)}</p>
            <div className="media-switches">
              <label className="media-switch">
                <input
                  type="checkbox"
                  checked={frozen}
                  onChange={(e) => onFreeze(e.target.checked)}
                />
                <span aria-hidden="true" />
                تجميد الأرقام أثناء التحرير
              </label>
              {t.live && (
                <label className="media-switch">
                  <input
                    type="checkbox"
                    checked={draft.stamp}
                    onChange={(e) => setDraft({ stamp: e.target.checked })}
                  />
                  <span aria-hidden="true" />
                  ختم وقت الأرقام على المنشور
                </label>
              )}
            </div>
          </section>
        )}

        <section className="media-panel">
          <h3>الرمز والرابط</h3>
          <label className="media-switch">
            <input
              type="checkbox"
              checked={draft.qrOn}
              onChange={(e) => setDraft({ qrOn: e.target.checked })}
            />
            <span aria-hidden="true" />
            رمز QR على المنشور
          </label>
          {draft.qrOn && (
            <div className="media-qr-styles" role="radiogroup" aria-label="شكل الرمز">
              {qrStyles.map((q) => (
                <button
                  key={q.id}
                  role="radio"
                  aria-checked={draft.qrStyle === q.id}
                  title={q.note}
                  onClick={() => setDraft({ qrStyle: q.id })}
                >
                  <QrSample style={q.id} />
                  {q.name}
                </button>
              ))}
            </div>
          )}
          <label className="media-field">
            <span>وجهة الرابط</span>
            <select
              value={draft.target}
              onChange={(e) => setDraft({ target: e.target.value as LinkTarget })}
            >
              {linkTargets.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {draft.qrOn && (
            <label className="media-field">
              <span>
                رمز التتبع
                <button
                  type="button"
                  className="media-reset"
                  onClick={() =>
                    setDraft({
                      code: newPostCode(t.id === 'chart' ? `chart-${draft.chart}` : t.id),
                    })
                  }
                >
                  رمز جديد
                </button>
              </span>
              <input
                dir="ltr"
                className="media-mono"
                value={draft.code}
                onChange={(e) =>
                  setDraft({
                    code: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_-]/g, '')
                      .slice(0, 40),
                  })
                }
                aria-invalid={!cleanSource(draft.code)}
              />
            </label>
          )}
          <div className="media-link">
            <bdi dir="ltr">{displayLink(link)}</bdi>
            <button
              className="media-icon"
              aria-label="نسخ الرابط"
              onClick={() => copy(link, 'الرابط')}
            >
              <Icon name="copy" size={16} />
            </button>
          </div>
          {draft.qrOn && (
            <p className="media-note">
              كل من يسجّل عبر هذا الرمز يُحتسب لهذا المنشور في التحليلات وسجل المنشورات.
            </p>
          )}
        </section>

        <section className="media-panel media-export">
          <h3>التصدير</h3>
          <div className="media-row">
            <div className="media-seg" role="radiogroup" aria-label="نوع الملف">
              {(['png', 'jpeg'] as const).map((v) => (
                <button key={v} role="radio" aria-checked={type === v} onClick={() => setType(v)}>
                  {v === 'png' ? 'PNG' : 'JPG'}
                </button>
              ))}
            </div>
            <div className="media-seg" role="radiogroup" aria-label="الدقة">
              {[1, 2].map((v) => (
                <button key={v} role="radio" aria-checked={scale === v} onClick={() => setScale(v)}>
                  {v.toLocaleString('ar-SA')}×
                </button>
              ))}
            </div>
          </div>
          <button
            className="media-primary"
            disabled={simulated || !!busy || (draft.qrOn && !cleanSource(draft.code))}
            onClick={exportOne}
          >
            {busy === 'one' ? 'جارٍ التجهيز…' : `تنزيل ${format.name} ${format.ratio}`}
            <i aria-hidden="true">
              <Icon name="download" size={16} />
            </i>
          </button>
          <button
            className="media-secondary"
            disabled={simulated || !!busy || (draft.qrOn && !cleanSource(draft.code))}
            onClick={exportAll}
          >
            {busy === 'all' ? 'جارٍ تجهيز المقاسات…' : 'حزمة المقاسات الخمسة مع النص المرافق'}
          </button>
          <p className="media-note">
            {simulated
              ? 'التنزيل متاح لبيانات المسابقة الفعلية فقط. أوقف معاينة المحاكاة للتنزيل.'
              : `${format.w * scale}×${format.h * scale} بكسل. تُسجَّل كل عملية تنزيل في سجل المنشورات مع نسخة من أرقامها.`}
          </p>
        </section>

        <section className="media-panel">
          <h3>النص المرافق</h3>
          <div className="media-seg wide" role="radiogroup" aria-label="المنصة">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={platform === p.id}
                onClick={() => setPlatform(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <textarea className="media-caption" dir="rtl" readOnly rows={6} value={caption} />
          <div className="media-row spread">
            <small>{caption.length.toLocaleString('ar-SA')} حرفًا</small>
            <button className="media-chip" onClick={() => copy(caption, 'النص المرافق')}>
              <Icon name="copy" size={15} /> نسخ
            </button>
          </div>
        </section>

        <section className="media-panel">
          <h3>الفحوص</h3>
          <ul className="media-checks">
            {checks.map((c) => (
              <li key={c.label} data-state={c.ok === null ? 'wait' : c.ok ? 'ok' : 'bad'}>
                <i aria-hidden="true" />
                <div>
                  <strong>{c.label}</strong>
                  {c.ok !== true && c.note && <small>{c.note}</small>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {bundle && (
        <div ref={rack} className="media-rack" aria-hidden="true">
          {posterFormats.map((f) => (
            <PosterView
              key={f.id}
              template={t}
              draft={draft}
              format={f}
              identity={identity}
              facts={F}
              options={options}
              base={base}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QrSample({ style }: { style: QrStyle }) {
  const p = useMemo(
    () => qrPaths(qrMatrix('https://nbc.sa/r', style === 'seal' ? 'H' : 'Q'), style),
    [style],
  );
  return (
    <svg viewBox={`-1 -1 ${p.size + 2} ${p.size + 2}`} aria-hidden="true">
      <path d={p.modules} />
      <path d={p.eyes} fillRule="evenodd" />
      {p.seal && (
        <circle
          cx={p.seal.start + p.seal.size / 2}
          cy={p.seal.start + p.seal.size / 2}
          r={p.seal.size / 2 - 0.5}
          className="seal"
        />
      )}
    </svg>
  );
}

function PostLog({
  participants,
  onOpen,
  toast,
}: {
  participants: AnalyticsParticipant[];
  onOpen: (p: MediaPost) => void;
  toast: (t: Toast) => void;
}) {
  const [posts, setPosts] = useState<MediaPost[] | null>(null);
  const [rows, setRows] = useState<InsightsData['rows'] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api<{ posts: MediaPost[] }>('admin/media')
      .then((r) => alive && setPosts(r.posts))
      .catch((e: Error) => alive && setError(e.message));
    api<InsightsData>('admin/analytics')
      .then((r) => alive && setRows(r.rows))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);
  const done = useMemo(
    () => new Set(participants.filter((p) => p.submitted_at).map((p) => p.id)),
    [participants],
  );
  const reach = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const r of rows ?? []) {
      if (!r.source) continue;
      const m = map.get(r.source) ?? { total: 0, completed: 0 };
      m.total++;
      if (done.has(r.id)) m.completed++;
      map.set(r.source, m);
    }
    return map;
  }, [rows, done]);
  if (error) return <p className="error-message">{error}</p>;
  if (!posts)
    return (
      <div className="media-loading" role="status">
        جارٍ تحميل السجل…
      </div>
    );
  if (!posts.length)
    return (
      <div className="media-empty">
        <span className="media-star" aria-hidden="true" />
        <h2>لا توجد منشورات مسجلة بعد</h2>
        <p>كل منشور تنزّله من المحرر يُسجَّل هنا برمزه، ويظهر بجانبه عدد من سجّلوا عبره.</p>
      </div>
    );
  const best = Math.max(1, ...posts.map((p) => reach.get(p.code)?.total ?? 0));
  const when = (iso: string) =>
    new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      calendar: 'gregory',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(iso));
  return (
    <div className="media-log">
      <p className="media-log-intro">
        {countOf(posts.length, POSTS, false)}. يُحتسب للمنشور كل من فتح الموقع عبر رمزه ثم سجّل.
      </p>
      <ol>
        {posts.map((p) => {
          const r = reach.get(p.code);
          const small = r && r.total > 0 && r.total < 5;
          return (
            <li key={p.code}>
              <div className="media-log-main">
                <strong>{p.title}</strong>
                <span>
                  {templateById(p.template).name} · {when(p.createdAt)} · {p.actor}
                  {p.exports > 1 && ` · ${countOf(p.exports, DOWNLOADS, false)}`}
                </span>
                <span className="media-log-formats">
                  {p.formats.map((f) => (
                    <em key={f}>{f === 'bundle' ? 'حزمة كاملة' : posterFormat(f).name}</em>
                  ))}
                  <bdi dir="ltr" className="media-mono">
                    {p.code}
                  </bdi>
                </span>
              </div>
              <div className="media-log-reach">
                <b>
                  {rows === null
                    ? '…'
                    : !r
                      ? '٠'
                      : small
                        ? 'أقل من ٥'
                        : r.total.toLocaleString('ar-SA')}
                </b>
                <span>سجّلوا عبره</span>
                <i style={{ width: `${((r?.total ?? 0) / best) * 100}%` }} aria-hidden="true" />
                {r && r.total >= 5 && (
                  <small>
                    أكمل {Math.round((r.completed / r.total) * 100).toLocaleString('ar-SA')}٪
                  </small>
                )}
              </div>
              <div className="media-log-actions">
                <button className="media-chip" onClick={() => onOpen(p)}>
                  فتح في المحرر
                </button>
                {p.link && (
                  <button
                    className="media-icon"
                    aria-label="نسخ الرابط"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(p.link)
                        .then(() => toast({ text: 'تم نسخ الرابط.', tone: 'ok' }))
                        .catch(() => toast({ text: 'تعذّر النسخ من المتصفح.', tone: 'warn' }))
                    }
                  >
                    <Icon name="copy" size={16} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

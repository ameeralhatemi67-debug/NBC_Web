'use client';
import type { PosterFormat } from '@/lib/media/formats';
import type { LinkTarget } from '@/lib/media/codes';
import { postLink } from '@/lib/media/codes';
import { freshness, type MediaFacts } from '@/lib/media/facts';
import type { QrStyle } from '@/lib/media/qr';
import type { ChartKind } from '@/lib/media/charts';
import { PosterFrame, type Identity, type Tone } from './poster-kit';
import type { PosterTemplate, TemplateOptions } from './templates';

// Everything the committee changed on one template. Missing text keys fall back to the live default.
export type Draft = {
  texts: Record<string, string>;
  tone?: Tone;
  qrOn: boolean;
  qrStyle: QrStyle;
  target: LinkTarget;
  code: string;
  stamp: boolean;
  chart: ChartKind;
  school: number;
};
export function posterTexts(t: PosterTemplate, draft: Draft, F: MediaFacts, o: TemplateOptions) {
  const defaults = t.defaults(F, o);
  const texts: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(draft.texts)) if (k in defaults) texts[k] = v;
  return { texts, defaults };
}
export function posterLink(base: string, draft: Draft) {
  return postLink(base, draft.target, draft.qrOn ? draft.code : null);
}

export function PosterView({
  template: t,
  draft,
  format,
  identity,
  facts: F,
  options: o,
  base,
  editable = false,
  watermark = false,
}: {
  template: PosterTemplate;
  draft: Draft;
  format: PosterFormat;
  identity: Identity;
  facts: MediaFacts;
  options: TemplateOptions;
  base: string;
  editable?: boolean;
  watermark?: boolean;
}) {
  const { texts: T } = posterTexts(t, draft, F, o);
  return (
    <PosterFrame
      label={`${t.name} · ${format.name}`}
      editable={editable}
      spec={{
        format,
        identity,
        tone: draft.tone ?? t.tone,
        qr: { on: draft.qrOn, style: draft.qrStyle },
        link: posterLink(base, draft),
        cta: T.cta ?? '',
        stamp: draft.stamp && t.live ? freshness(F.asOf) : null,
        watermark,
      }}
    >
      {({ P, L, id }) => t.render({ P, L, id, F, T, o })}
    </PosterFrame>
  );
}

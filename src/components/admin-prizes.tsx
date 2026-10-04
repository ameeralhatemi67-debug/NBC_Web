'use client';
import { useState } from 'react';
import { prizeTotal, type PrizeSettings } from '@/lib/prizes';
import { api, ErrorMessage, Icon } from './ui';
import { CompetitionPrizes } from './competition-prizes';

export function AdminPrizes({
  settings,
  onSaved,
}: {
  settings: PrizeSettings;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<PrizeSettings>(() => structuredClone(settings));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const validAmount = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 10000000;
  const valid =
    validAmount(draft.mediaPrize) && draft.stages.every((s) => s.awards.every(validAmount));
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);
  async function save() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api('admin/prizes', draft);
      await onSaved();
      setDraft({ ...draft, version: draft.version + 1 });
      setNotice('تم حفظ الجوائز والتصميم. تظهر التغييرات عند فتح الموقع أو تحديثه.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="panel prize-editor"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="panel-heading">
          <h2>الجوائز المالية وتصميم العرض</h2>
          <span>
            الإجمالي <bdi>{valid ? prizeTotal(draft).toLocaleString('en-US') : '—'}</bdi> ريال
          </span>
        </div>
        <p>
          عدّل مبلغ كل مركز بالريال السعودي. يُحسب إجمالي الجوائز تلقائيًا مع جائزة التميز الإعلامي.
        </p>
        <ErrorMessage message={error} />
        {notice && (
          <p className="success-message" role="status">
            {notice}
          </p>
        )}
        <fieldset disabled={busy}>
          <div className="prize-editor-grid">
            {draft.stages.map((stage, i) => (
              <fieldset key={stage.name}>
                <legend>{stage.name}</legend>
                <div className="prize-amount-grid">
                  {stage.awards.map((amount, rank) => (
                    <label key={rank}>
                      المركز {rank + 1}
                      <input
                        aria-label={`المركز ${rank + 1}`}
                        type="number"
                        min="0"
                        max="10000000"
                        step="1"
                        required
                        value={Number.isNaN(amount) ? '' : amount}
                        onChange={(e) => {
                          setNotice('');
                          setDraft({
                            ...draft,
                            stages: draft.stages.map((s, j) =>
                              j === i
                                ? {
                                    ...s,
                                    awards: s.awards.map((n, k) =>
                                      k === rank ? e.target.valueAsNumber : n,
                                    ),
                                  }
                                : s,
                            ),
                          });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="form-grid">
            <label>
              جائزة التفاعل والتميز الإعلامي
              <input
                aria-label="جائزة التفاعل والتميز الإعلامي"
                type="number"
                min="0"
                max="10000000"
                step="1"
                required
                value={Number.isNaN(draft.mediaPrize) ? '' : draft.mediaPrize}
                onChange={(e) => setDraft({ ...draft, mediaPrize: e.target.valueAsNumber })}
              />
            </label>
            <label>
              تصميم قسم الجوائز
              <select
                aria-label="تصميم قسم الجوائز"
                value={draft.layout}
                onChange={(e) =>
                  setDraft({ ...draft, layout: e.target.value as PrizeSettings['layout'] })
                }
              >
                <option value="podium">منصة التتويج</option>
                <option value="ledger">قائمة المراكز</option>
              </select>
            </label>
          </div>
          <p className="fine-print">
            يُطبّق التصميم على النسختين الرسمية والمزيج. تظل مبالغ الجوائز موحّدة في التصاميم
            الثلاثة. استخدم زر تغيير التصميم لمعاينة كل هوية.
          </p>
          <div className="button-row">
            <button className="button primary" disabled={busy || !valid || !changed} type="submit">
              <Icon name="check" size={18} />
              {busy ? 'جارٍ الحفظ…' : 'حفظ الجوائز والتصميم'}
            </button>
            <button
              className="button outline"
              type="button"
              onClick={() => {
                setDraft(structuredClone(settings));
                setError('');
                setNotice('');
              }}
              disabled={!changed}
            >
              إلغاء التعديلات
            </button>
            <button
              type="button"
              className="text-link"
              disabled={!valid}
              onClick={() => setShowPreview(!showPreview)}
              aria-expanded={showPreview}
            >
              {showPreview ? 'إخفاء المعاينة' : 'معاينة قبل الحفظ'}
            </button>
          </div>
        </fieldset>
      </form>
      {showPreview && valid && (
        <div className="prize-editor-preview">
          <p className="notice">معاينة التعديلات الحالية. لن تظهر للزوار حتى الحفظ.</p>
          <CompetitionPrizes settings={draft} preview />
        </div>
      )}
    </>
  );
}

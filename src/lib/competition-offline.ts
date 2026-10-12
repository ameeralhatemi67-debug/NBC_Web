import { finalSubmission, type CompetitionState, type WriteEvent } from './competition-domain';
import { openingReaderPage } from './reader-presentation';
export type LocalCompetition = {
  state: CompetitionState;
  events: WriteEvent[];
  conflicts: { event: WriteEvent; message: string }[];
  index: number;
  page: number;
  maxPage: number;
};
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('nbc-competition-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sessions');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(new Error('تعذّر فتح التخزين المحلي. استعد التخزين قبل حفظ الإجابات.'));
  });
}
export async function localRead<T>(key: string): Promise<T | undefined> {
  const db = await openStore();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction('sessions').objectStore('sessions').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function localWrite(key: string, value: unknown) {
  const db = await openStore();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function overlayPending(state: CompetitionState, events: WriteEvent[]): CompetitionState {
  const next = structuredClone(state);
  const a = next.attempt;
  if (!a || a.submittedAt) return next;
  for (const e of events) {
    if (e.attemptId !== a.id || !e.questionId || !e.selected || a.answers[e.questionId]?.locked)
      continue;
    a.answers[e.questionId] = {
      selected: e.selected,
      locked: e.kind === 'CHECK',
      checkedAt: e.kind === 'CHECK' ? 'local-pending' : null,
    };
  }
  return next;
}
export type Transport = {
  state(): Promise<CompetitionState>;
  write(event: WriteEvent): Promise<CompetitionState>;
};
export type SyncError = Error & { code?: string; status?: number };
export class DurableCompetitionSession {
  record!: LocalCompetition;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(
    public key: string,
    private transport: Transport,
    private changed: (
      record: LocalCompetition,
      status: 'saved' | 'local' | 'syncing' | 'error',
      message?: string,
    ) => void,
  ) {}
  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const task = async () =>
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(this.key, run)
        : run();
    const next = this.chain.then(task, task);
    this.chain = next.catch(() => {});
    return next;
  }
  async init(state: CompetitionState) {
    return this.exclusive(async () => {
      const old = await localRead<LocalCompetition>(this.key);
      this.record =
        old && old.state.attempt?.id === state.attempt?.id
          ? { ...old, state }
          : {
              state,
              events: [],
              conflicts: [],
              index: 0,
              page: openingReaderPage(state.book),
              maxPage: 1,
            };
      await this.persist();
      this.changed(this.record, this.record.events.length ? 'local' : 'saved');
    });
  }
  private async persist() {
    const state = {
      ...this.record.state,
      participant: {
        name: this.record.state.participant.name.split(' ')[0],
        stage: this.record.state.participant.stage,
      },
    };
    await localWrite(this.key, { ...this.record, state });
  }
  async remember(index: number, page: number, maxPage: number) {
    return this.exclusive(async () => {
      this.record = (await localRead<LocalCompetition>(this.key)) ?? this.record;
      Object.assign(this.record, { index, page, maxPage });
      await this.persist();
    });
  }
  async enqueue(event: WriteEvent) {
    return this.exclusive(async () => {
      this.record = (await localRead<LocalCompetition>(this.key)) ?? this.record;
      if (
        this.record.state.attempt?.submittedAt ||
        this.record.events.some((e) => e.kind === 'SUBMIT')
      )
        throw new Error('الإرسال النهائي قيد التنفيذ أو اكتمل. انتظر تأكيد الخادم.');
      if (finalSubmission(this.record.state.competition))
        event = {
          ...event,
          revision: this.record.state.attempt!.revision + this.record.events.length,
        };
      this.record.events.push(event);
      await this.persist();
      this.changed(this.record, 'local');
    });
  }
  async sync(offline = false) {
    return this.exclusive(async () => {
      this.record = (await localRead<LocalCompetition>(this.key)) ?? this.record;
      if (offline || !navigator.onLine) {
        this.changed(this.record, 'local');
        return;
      }
      if (!this.record.events.length) return;
      this.changed(this.record, 'syncing');
      try {
        this.record.state = await this.transport.state();
        while (this.record.events.length) {
          const e = this.record.events[0];
          try {
            this.record.state = await this.transport.write({
              ...e,
              revision: finalSubmission(this.record.state.competition)
                ? e.revision
                : this.record.state.attempt!.revision,
            });
            this.record.events.shift();
            await this.persist();
          } catch (err) {
            const error = err as SyncError;
            if (['ANSWER_LOCKED', 'SUBMITTED'].includes(error.code ?? '')) {
              this.record.state = await this.transport.state();
              this.record.conflicts.push({ event: e, message: error.message });
              this.record.events.shift();
              await this.persist();
              continue;
            }
            if (error.code === 'REVISION_CONFLICT') {
              this.record.state = await this.transport.state();
              if (finalSubmission(this.record.state.competition)) {
                this.record.conflicts.push(
                  ...this.record.events.map((event) => ({ event, message: error.message })),
                );
                this.record.events = [];
              }
              await this.persist();
              throw new Error(
                'تغيرت الإجابات من نافذة أخرى. راجع النسخة المحفوظة وأعد اختيار الإجابات قبل الإرسال.',
              );
            }
            if (e.kind === 'SUBMIT' && error.code === 'INCOMPLETE') {
              this.record.events.shift();
              this.record.state = await this.transport.state();
              await this.persist();
            }
            throw err;
          }
        }
        const legacyConflict =
          !finalSubmission(this.record.state.competition) && this.record.conflicts.length > 0;
        this.changed(
          this.record,
          legacyConflict ? 'error' : 'saved',
          legacyConflict
            ? 'اعتمدنا الإجابات المحفوظة على الخادم. التعارضات محفوظة محليًا.'
            : undefined,
        );
      } catch (e) {
        await this.persist();
        this.changed(this.record, !navigator.onLine ? 'local' : 'error', (e as Error).message);
      }
    });
  }
}

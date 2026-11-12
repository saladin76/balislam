/** One outstanding request, with the latest edit retained until the server acknowledges it. */
export class PlanSaveQueue<T> {
  private pending: { channel: string; episode: string; value: T } | null = null;
  private flight: Promise<void> | null = null;
  private revisions = new Map<string, string | Promise<string>>();
  constructor(private save: (item: { channel: string; episode: string; value: T }, revision: string) => Promise<string>) {}
  private key(channel: string, episode: string) { return `${channel}/${episode}`; }
  seed(channel: string, episode: string, revision: string | Promise<string>) {
    if (this.pending && this.key(this.pending.channel, this.pending.episode) === this.key(channel, episode)) return;
    this.revisions.set(this.key(channel, episode), revision);
  }
  enqueue(channel: string, episode: string, value: T) {
    if (this.pending && this.key(channel, episode) !== this.key(this.pending.channel, this.pending.episode))
      throw new Error("احفظ تعديل الحلقة الحالية قبل فتح حلقة أخرى.");
    this.pending = { channel, episode, value };
  }
  get hasPending() { return this.pending !== null || this.flight !== null; }
  get snapshot() { return this.pending; }
  flush(): Promise<void> {
    if (this.flight) return this.flight;
    if (!this.pending) return Promise.resolve();
    const drain = async () => {
      while (this.pending) {
        const item = this.pending;
        const key = this.key(item.channel, item.episode);
        const revision = await this.revisions.get(key);
        if (!revision) throw new Error("تعذّر تحديد نسخة الخطة؛ تعديلك باقٍ هنا. أعد المحاولة بعد استعادة الاتصال.");
        const next = await this.save(item, revision);
        this.revisions.set(key, next);
        // An edit made during the request is sent next, against the acknowledged revision.
        if (this.pending === item) this.pending = null;
      }
    };
    this.flight = drain().finally(() => { this.flight = null; });
    return this.flight;
  }
}

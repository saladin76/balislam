/**
 * Edits in progress outside the plan's own save state (KI, 15 Nov: «بحاول اغير النطق ولكن يعيده الي القديم»): an open
 * word popover, a sentence «النطق» being typed, a sentence text being edited. While any is open, the auto-sync
 * (SyncBadge, D101) does not reload the page for an arriving update; it reloads once they are saved or cancelled.
 */
const open = new Set<string>();
export const markEditing = (key: string, on: boolean) => { if (on) open.add(key); else open.delete(key); };
export const editingInProgress = () => open.size > 0;

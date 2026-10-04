// Screen Wake Lock — keeps the display on while the simulation plays.
//
// iOS Safari notes:
// - navigator.wakeLock exists on iOS 16.4+; earlier versions just no-op here.
// - Requests must follow a user gesture. The first pointerdown after
//   activation satisfies this, so we retry on every pointerdown while armed.
// - The OS auto-releases the lock when the tab hides; we re-acquire on
//   visibilitychange back to visible.

export class WakeLockManager {
    constructor() {
        this.sentinel = null;
        this.enabled = false;

        this._onVisibility = () => {
            if (document.visibilityState === 'visible') this.refresh();
        };
        // iOS needs a gesture to grant the lock — retry on real input.
        this._onGesture = () => { if (this.enabled && !this.sentinel) this.refresh(); };

        document.addEventListener('visibilitychange', this._onVisibility);
        document.addEventListener('pointerdown', this._onGesture);
    }

    setActive(active) {
        this.enabled = active;
        this.refresh();
    }

    async refresh() {
        if (!('wakeLock' in navigator)) return;

        if (this.enabled && document.visibilityState === 'visible' && !this.sentinel) {
            try {
                this.sentinel = await navigator.wakeLock.request('screen');
                this.sentinel.addEventListener('release', () => {
                    this.sentinel = null;
                    if (this.enabled) this.refresh();
                });
            } catch {
                // Denied (no gesture yet, low battery, etc.) — retry on next input.
            }
        } else if (!this.enabled && this.sentinel) {
            const s = this.sentinel;
            this.sentinel = null;
            s.release().catch(() => {});
        }
    }

    destroy() {
        document.removeEventListener('visibilitychange', this._onVisibility);
        document.removeEventListener('pointerdown', this._onGesture);
        this.enabled = false;
        if (this.sentinel) {
            const s = this.sentinel;
            this.sentinel = null;
            s.release().catch(() => {});
        }
    }
}

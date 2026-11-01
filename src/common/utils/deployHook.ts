import { env } from "../../config/env";

/**
 * Trigger a Vercel rebuild of the frontend after content changes.
 *
 * ── Why this is needed ──
 *
 * Both indexable frontend templates set `dynamicParams = false` and build their
 * URL list from `generateStaticParams`, which runs ONLY at build time. That was
 * deliberate: without it, `notFound()` rendered with HTTP 200 on Vercel, so
 * /handout/<anything>/<term> was an unbounded space of soft-404s for Google to
 * crawl. The trade-off is that a handout imported after the last build has no page
 * — it returns a real 404 until something rebuilds.
 *
 * Long handouts are now also split into parts whose slugs come from the markdown
 * headings, so editing a handout's structure changes its URL set too. Both make a
 * rebuild-on-import non-optional.
 *
 * ── Setup (two halves) ──
 *
 * 1. In VERCEL: Project → Settings → Git → Deploy Hooks. Create one for the
 *    deployed branch; Vercel returns a URL of the form
 *    https://api.vercel.com/v1/integrations/deploy/prj_XXXX/YYYY
 *    Treat that URL as a secret — anyone holding it can trigger builds.
 * 2. In THIS SERVICE: set VERCEL_DEPLOY_HOOK_URL to that URL (Northflank →
 *    service → Environment). Leave it unset locally and in CI, where it is a
 *    no-op, so development imports never burn production build minutes.
 *
 * ── Debounce ──
 *
 * A bulk import POSTs one handout at a time, so firing per request would queue
 * hundreds of builds. Calls are coalesced into a single trigger once writes have
 * been quiet for DEBOUNCE_MS.
 *
 * The timer is in-process, so a restart mid-window drops a pending trigger and
 * several service replicas would each fire their own. Both are acceptable: the
 * failure mode is a missed or duplicated build, never wrong content. If this ever
 * needs to be exact, move the pending flag into Mongo and have one worker drain it.
 */

const DEBOUNCE_MS = 3 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let pendingReasons = new Set<string>();

async function fire(reasons: string[]): Promise<void> {
  const url = env.VERCEL_DEPLOY_HOOK_URL;
  if (!url) return;

  try {
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      console.error(
        `Vercel deploy hook returned ${res.status} ${res.statusText}`,
      );
      return;
    }
    console.log(`Vercel rebuild triggered (${reasons.join(", ")})`);
  } catch (err) {
    // Never let a failed rebuild break the import that caused it — the content is
    // already saved, and the next write (or a manual deploy) will pick it up.
    console.error("Vercel deploy hook failed:", err);
  }
}

/**
 * Request a frontend rebuild. Safe to call on every content write: the actual
 * trigger is debounced, and it is a no-op when VERCEL_DEPLOY_HOOK_URL is unset.
 *
 * @param reason short label for the log, e.g. "handout:CS201/midterm"
 */
export function requestFrontendRebuild(reason: string): void {
  if (!env.VERCEL_DEPLOY_HOOK_URL) return;

  pendingReasons.add(reason);

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const reasons = [...pendingReasons];
    pendingReasons = new Set();
    timer = null;
    void fire(reasons);
  }, DEBOUNCE_MS);

  // Don't hold the event loop open on shutdown. The HTTP listener keeps the
  // process alive in normal operation, so this only matters while draining.
  timer.unref?.();
}

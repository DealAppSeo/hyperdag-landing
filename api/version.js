// Which commit is this surface actually running?
//
// WHY THIS EXISTS — and the reason is a correction, which makes it stronger.
//
// An assessment on 2026-08-14 concluded that this site was serving content that
// existed in no commit, built from the wrong repository, surviving only on a
// rollback. **That conclusion was wrong and has been retracted.** It failed in
// two ways at once: it read deployment state off `hyperdag-org`, a Vercel project
// whose name matches the domain but which serves no custom domain at all (the
// site is served by `hyperdag-trust`); and its central discrepancy — 28,908 vs
// 29,093 — compared a character count against a byte count of the same file.
// Hashing both sides settles it: md5 ff2ef682522185a58e942b1dbd84c6d3, identical.
//
// So this endpoint is not here because the deployment was broken. It is here
// because **two competent attempts to determine what this site was running, from
// the outside, both got it wrong** — first alarmingly, then only after pulling
// project metadata, deployment lists and content hashes across two APIs.
//
// A version endpoint collapses all of that into one request that the running
// deployment answers about itself. Inference from the outside is what failed;
// self-report is what fixes it. "Up" and "up but running something unexpected"
// are indistinguishable without it, and the cost of guessing wrong is a retracted
// finding and the work it triggers.
//
// This is a static site with no framework and no package.json, so this is a
// Vercel zero-config Node function (any file under /api at the project root),
// not a framework route. It is CommonJS deliberately: without a package.json
// declaring "type": "module", a .js file here is CJS, and ESM syntax would fail
// at runtime rather than at deploy time.
//
// Field names match trinity-ecosystem's and trustshell's /api/version so a probe
// does not need to know which surface it is talking to.
//
// PUBLIC AND UNAUTHENTICATED, deliberately — a commit SHA is not a secret, and
// requiring a credential defeats the purpose of checking a deploy from outside.
// A fixed set of named fields is returned; the environment is never enumerated,
// so a new platform variable cannot leak through here by accident.

/**
 * Resolve the deployed commit from whichever platform built this.
 *
 * Read as literals rather than by looping over process.env, so the exposed set
 * stays auditable.
 */
function resolveDeployment() {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return { commit: vercelSha, platform: 'vercel' };

  const genericSha = process.env.GIT_COMMIT_SHA;
  if (genericSha) return { commit: genericSha, platform: 'unknown' };

  // 'unknown' rather than a fake value or a silent omission. A caller comparing
  // this against origin/main must be able to tell "not wired up here" apart from
  // "running an old commit" — those need different fixes, and collapsing them is
  // how an ambiguous reading becomes a confident wrong one.
  return { commit: 'unknown', platform: 'unknown' };
}

module.exports = (req, res) => {
  const { commit, platform } = resolveDeployment();

  // Never cached. A version endpoint served from an edge cache reports the
  // PREVIOUS deployment's SHA — it answers confidently and wrongly, which is
  // worse than not answering.
  res.setHeader('cache-control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('content-type', 'application/json; charset=utf-8');

  res.status(200).send(
    JSON.stringify({
      commit,
      commit_short: commit === 'unknown' ? 'unknown' : commit.slice(0, 7),
      platform,
      // Environment NAME only — never values.
      environment: process.env.VERCEL_ENV || 'unknown',
      region: process.env.VERCEL_REGION || null,
      // Answered-at, not built-at. Do not read this as a build timestamp.
      responded_at: new Date().toISOString(),
    }),
  );
};

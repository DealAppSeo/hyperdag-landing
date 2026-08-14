// Which commit is this surface actually running?
//
// WHY THIS EXISTS, and why here first. On 2026-08-14 an assessment found that
// hyperdag.org was serving 28,908 bytes that match no revision of index.html in
// this repository. The live content came from a Vercel Instant Rollback to a
// deployment made before the project was connected to git, and the newest
// production deploy was in state ERROR and had been built from `repid-engine` —
// a different repository entirely. Throughout all of that the domain returned a
// healthy 200.
//
// Nothing outside the Vercel dashboard could have detected it, because there was
// no way to ask the running site what it was. That is the whole cost of not
// having this endpoint: the site is either up or down, and "up but serving
// something unreproducible from source" reads as up.
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
  // "running an old commit" — those need different fixes. Given this project's
  // history, 'unknown' here is itself the signal that the deployment is not
  // coming from git.
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

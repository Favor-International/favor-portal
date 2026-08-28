# Deploying the portal

**Production runs the `feature/blackbaud-giving-history` branch, not `main`.**
Routes under `app/(portal)/` whose folder starts with `_` are archived and not
routable.

## The one deploy path

```
npm run typecheck
npx opennextjs-cloudflare build
# The build appends to this file, so a repeat build duplicates its exports and
# the deploy bundler then fails with "Multiple exports with the same name".
printf 'export const production = {};\nexport const development = {};\nexport const test = {};\n' > .open-next/cloudflare/next-env.mjs
npx opennextjs-cloudflare deploy
```

Credentials come from `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY`
(`~/.claude/secrets/favor-will-cf.txt`).

## Confirming what actually serves

The Worker's version list is not the answer: Cloudflare's git integration
builds this branch and uploads versions that are never promoted, so the newest
version in the list is often NOT the one taking traffic. That is what made the
dashboard confusing on 2026-08-06. Ask the deployments endpoint instead:

```
curl -s "https://api.cloudflare.com/client/v4/accounts/6e975b8c8e7bea3f644c0eb722af991f/workers/scripts/favor-portal/deployments" \
  -H "X-Auth-Email: will@favorintl.org" -H "X-Auth-Key: $KEY" \
  | jq -r '.result.deployments[0] | "\(.created_on)  \(.versions[] | "\(.version_id) @\(.percentage)%")"'
```

`deployments[0]` is the live one.

## Confirming the code inside it

Version ids prove nothing about content. Grep the served bundle:

```
# find which chunk holds the change locally, then fetch that exact path
grep -rl "some string you added" .open-next/assets/_next/static/chunks/
curl -s "https://my.favorintl.org/_next/static/chunks/<that path>" | grep -c "some string you added"
```

Page chunks live under `_next/static/chunks/app/(portal)/<page>/`; fetching
`/dashboard` while signed out redirects to login and gives you the wrong chunk
names.

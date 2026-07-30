# Auth0 setup

## Why Auth0 is core here

The confirmer role is the reason this is real multi-user SaaS and not a login
screen. A confirmer can approve exactly one unlock condition and can see nothing
else — not the amount, not other gifts, not any money control. That scoped,
single-purpose authorization is the thing to demo when a judge asks why Auth0
matters to the build.

## Roles

- sender — ordinary authenticated user. Can create, fund, and view own gifts.
- recipient — ordinary authenticated user. Can view gifts addressed to them and
  withdraw released ones.
- confirmer — scoped, single-condition access. NOT a global role; granted per
  condition via an invite.

Sender and recipient are the same account type — a person is a sender for gifts
they create and a recipient for gifts addressed to their email. Confirmer is the
special case.

## Confirmer scoping — two options

Pick the simpler one for the hackathon (Option A).

### Option A — signed single-purpose invite link (recommended)
1. When a sender picks a third_party condition, create the Condition and a
   pending Confirmation row.
2. Generate a signed token (JWT or a signed URL) encoding { conditionId } with a
   short expiry.
3. Email/show the link to the confirmer. They log in via Auth0, and the app
   grants access to that one condition only, based on the verified token.
4. The confirmer page renders ONLY the yes/no question and gift context. Every
   confirmer-facing query filters to that conditionId and never selects the
   amount.

### Option B — Auth0 Organizations
- Model each gift needing confirmation as an org; add the confirmer as a member
  with a `confirmer` role scoped to that org. More setup; only if you have time.

## Middleware rules

- All /gift routes require an authenticated session.
- /confirm/[token] validates the signed token server-side before rendering.
- Any query that could expose amountCents is gated to sender or recipient of
  that gift. Confirmer queries are physically separate and amount-free.

## Env vars

```
AUTH0_SECRET=            # openssl rand -hex 32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_TENANT.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
CONFIRM_TOKEN_SECRET=    # for signing confirmer invite links
```

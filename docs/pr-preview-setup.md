# PR Preview setup

The repository is prepared for GitHub-hosted quality checks and Vercel Preview
deployments backed by isolated Neon branches. No cloud credentials are committed.

## Vercel

1. Import the private `pjxkqc/xiaofei` repository into a personal Hobby account.
2. Set the project Root Directory to `apps/saas` and Node.js to 22.
3. Keep Preview and Production environment variables separate.
4. Do not set a fixed `NEXT_PUBLIC_SAAS_URL` for Preview deployments. The app uses
   Vercel's deployment URL so auth callbacks and cookies stay on the current Preview.
5. Add a high-entropy `BETTER_AUTH_SECRET` scoped to Preview.
6. Set `MAIL_PROVIDER=console` for Preview so synthetic registrations never call an
   external mail service.

## Neon

1. Create a Free project containing only disposable Preview data.
2. Install the Neon Vercel integration and enable Preview branching.
3. Map the Preview branch's pooled connection string to `DATABASE_URL`.
4. Map its direct/unpooled connection string to `DATABASE_URL_UNPOOLED` or
   `DIRECT_URL`.
5. Enable obsolete branch cleanup.

The Vercel build runs `prisma db push` against the unpooled connection and then
builds the application with the pooled runtime connection. It fails with variable
names only when either connection is absent.

## GitHub quality checks

Every pull request receives a fresh PostgreSQL service inside GitHub Actions.
The workflow initializes its schema and runs lint, formatting, type checks, unit
tests, production builds, and Chromium tests. It never uses the Neon Preview
database or cloud database credentials.

Vercel's Git integration supplies the Preview deployment status after the project
is imported. Configure branch protection after the first real PR so both the
`lint-type-test-build` check and the Vercel deployment are required.

## Current cloud resources

- Vercel project: `flyranking16/xiaofei-preview`
- Production URL: `https://xiaofei-preview.vercel.app`
- Neon project: `neon-bronze-paddle` in AWS Singapore
- Neon plan: Free, with no payment method configured
- Neon integration: Production and Preview environments connected, with an
  isolated database branch created for each Preview deployment

## Signup behavior

`packages/auth/config.ts` sets `requireEmailVerification` to `false`. Password
signups are automatically signed in and continue to onboarding without sending or
waiting for a verification email.

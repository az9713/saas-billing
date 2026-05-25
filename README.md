This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## About

This application was built using the seven-agent software factory chain in [az9713/software-factory](https://github.com/az9713/software-factory), which was created by [Claude Code](https://claude.ai/code) based on Qudrat Ullah's "software factory" recipe described in [How to Build a Software Factory with Claude Code](https://www.freecodecamp.org/news/how-to-build-software-factory-with-claude-code) on freeCodeCamp.

The seven agents in the chain are:

1. **codebase-researcher** — maps the relevant parts of the codebase before any code is written
2. **story-writer** — turns the feature idea and research findings into a user story with acceptance criteria
3. **spec-writer** — converts the approved story into a technical brief the build agents can follow
4. **backend-builder** — implements API routes, services, database access, and backend tests
5. **frontend-builder** — implements components, pages, and client-side tests
6. **test-verifier** — writes acceptance tests and confirms every acceptance criterion holds
7. **implementation-validator** — compares the implementation against the story and brief, reports gaps by severity

A full session transcript showing these agents in action for the user registration feature is in [docs/software-factory-seven-agent-chain.txt](docs/software-factory-seven-agent-chain.txt).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

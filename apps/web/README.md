This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## Backend API

The frontend connects to the Express API at `http://localhost:8000/api` by default. To use a different backend, set `NEXT_PUBLIC_API_BASE_URL` in `apps/web/.env.local`, for example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

Purchase requests, approvals, orders, and policy rules are loaded from the backend. Empty responses are shown as empty states; backend connection and server errors can be retried from the shared error dialog.

## Onboarding and notifications

The welcome guide appears once per browser and can be reopened from the help button. In-app notifications use a structured record and are retained in the current browser session across route changes. Technical alerts use customer-friendly copy; payment failures and successful purchase decisions use distinct color-coded feedback.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

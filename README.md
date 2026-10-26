# KaguOs

KaguOs is Kagu's internal system for the studio's team — work, learning, management, and debug
boards in one app, replacing a scattered mix of spreadsheets and one-off tools. Built with Next.js,
TypeScript, Tailwind CSS, and Supabase.

See [PRODUCT.md](./PRODUCT.md) for product scope and [DESIGN.md](./DESIGN.md) for the design
system.

## Getting Started

Install dependencies, then run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build and run
- `npm run lint` — lint the codebase
- `npm run check:demo` — validate demo filters
- `npm run check:principals` — validate principals config
- `npm run seed:learn` — seed Learn levels

## Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) for auth and data
- [Tailwind CSS](https://tailwindcss.com)

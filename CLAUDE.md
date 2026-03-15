# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `pnpm dev` (Vite with HMR)
- **Build:** `pnpm build` (runs `tsc -b && vite build`, output in `dist/`)
- **Lint:** `pnpm lint` (ESLint with TypeScript + React Hooks + React Refresh rules)
- **Preview production build:** `pnpm preview`

## Tech Stack

- React 19 + TypeScript (~5.9) + Vite 7, using SWC for Fast Refresh (`@vitejs/plugin-react-swc`)
- Package manager: pnpm
- No test framework configured yet

## Architecture

Single-page app. Entry point is `src/main.tsx` → renders `<App />` inside `<StrictMode>`. Static assets go in `public/`.

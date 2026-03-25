# Cô Ơi — Vietnamese Class Companion

A warm, playful flashcard app for Vietnamese language learners. Built for iPad and mobile, designed to make vocab review feel effortless and fun.

---

## What it does

Cô Ơi helps you capture vocabulary from class and homework, review it as flashcards, and test yourself with quizzes — all organized by week.

---

## Features

### Weeks
- Create named weeks to organize your vocab (e.g. "Week 3 — Family")
- Rename weeks inline by tapping the pencil icon
- Delete a week (with confirmation) — removes the week and all its cards

### Cards
- Add cards by typing Vietnamese — English translation is fetched automatically
- Tag each card as **Class** or **Homework** at input time
- Cards display in a grid with a corner tag (C / H) for source
- Search cards by Vietnamese or English text
- Filter by All / Class / Homework
- Edit any card's Vietnamese, English, or word-by-word breakdown
- Delete individual cards from the edit modal

### Flashcard Study
- Tap a card to flip and reveal the translation
- Cards with breakdowns show color-coded word chunks on both sides
- Tap any Vietnamese chunk to hear it spoken (Web Speech API)
- Corner speaker button pronounces the full phrase at any time
- Progress bar and card counter track where you are
- Navigate with ‹ › arrows

### Word Breakdown Import
- Paste a Claude-generated JSON breakdown to annotate cards with chunk-by-chunk translations
- Each Vietnamese chunk becomes a tappable, color-coded pill in Study mode

### Quiz Mode *(coming soon)*
Three quiz formats planned:
- **Multiple Choice** — pick the correct English for a Vietnamese card
- **Pair Match** — tap to connect scrambled Vietnamese ↔ English pairs
- **Quick Fire** — reveal and self-grade with Got it / Not yet

See [QUIZ.md](./QUIZ.md) for the full design spec.

---

## Tech stack

| Layer | Tool |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres) |
| Fonts | Baloo 2 (display) + Nunito (body) |
| TTS | Web Speech API |

---

## Getting started

```bash
npm install
npm run dev
```

Set up a `.env` file with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

The Supabase database needs two tables:

**`weeks`** — `id`, `title`, `created_at`

**`flashcards`** — `id`, `week_id`, `vietnamese`, `english`, `source` (`'class'` | `'homework'`), `status`, `breakdown` (jsonb, nullable), `created_at`

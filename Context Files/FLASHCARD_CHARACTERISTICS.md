# Flashcard Characteristics

Reference for the exercise/flashcard system in the Woodpecker app — the
Duolingo-style challenge deck used on the Exercises play page
(`/exercises/[id]/play`) and the per-cycle practice sessions.

## Deck layout (FlashcardDeck)

- Full-viewport layout: header (progress) pinned top, controls pinned bottom,
  the card fills the middle and scrolls **inside the card** (`overflow-y-auto`);
  the page itself never scrolls.
- Dark glass card: `rounded-[28px]`, `glass-card`, soft layered shadows,
  padding `p-8 sm:p-10`.
- Top of card: badge (`bg-accent-lime` pill) + item counter (`3 / 12`).
- Challenge title (config-driven per type) + instruction text.
- Avatar + source sentence row with a **Listen** button (TTS).
- Bottom controls: **Previous** (disabled until answered), **Shuffle**,
  **Next** (shown after answering, becomes **Finish** on the last item).
- Back button (`router.back()`) above the card.
- Empty state (no exercises): centered glass placeholder, shown only after all
  hooks.

## Exercise types (8)

| Type | Challenge title | XP | Practice dimension | Avatar emotion |
| --- | --- | --- | --- | --- |
| `translation` | Write this sentence | 15 | vocabulary | correct |
| `multiple-choice` | Choose the correct answer | 10 | grammar | happy |
| `fill-blank` | Complete the sentence | 12 | grammar | happy |
| `recall` | Which word means this? | 10 | vocabulary | correct |
| `pattern-drill` | Match the sentence pattern | 12 | grammar | thinking |
| `roleplay` | Say it aloud | 15 | speaking | celebrate |
| `comprehension` | Read and answer | 8 | reading | correct |
| `assessment` | Apply what you learned | 20 | other | celebrate |

XP +5 bonus on first-try (perfect) answers.

## Interaction per type

- **translation / pattern-drill** → `SentenceBuilder`: tap word chips to fill
  slots, drag-free tap-to-place; normalizes punctuation/case for judging.
- **fill-blank** → `GapFiller`: sentence with visual dashed gaps + word bank.
- **multiple-choice** → lettered option tiles (A/B/C/D), keyboard 1–9 to pick.
- **recall / comprehension / assessment** → text area (textarea auto-height);
  recall adds word-bank chips that tap to append.
- **roleplay / speaking** → `VoiceRecorder` (MediaRecorder): mic button,
  recording state with red pulse, audio preview, re-record (Trash2), cleanup on
  unmount.
- **reading** → passage box (max-h, internal scroll) above the question.
- **listening** → audio-centered flow:
  - waveform + **Play/Replay** button, **speed** toggle 0.5–1.5×
    (TTS `speechSynthesis`, rate scaled, locale from `locale ?? 'de-DE'`).
  - **transcript** toggle (hidden in higher cycles).
  - **mode select**: Multiple choice / Reconstruct / Dictation.
  - source text attached from `Lesson.materials.reading.passage` /
    `listening.transcript` by practice dimension.

## Answer & feedback

- **Correct**: green glow border (`rgba(16,185,129,0.5)`), success bounce
  (`scale:[1,1.015,1]`), confetti, XP toast (`+15 XP`), random positive phrase,
  FeedbackPanel with check icon + next action.
- **Incorrect**: gentle shake (`x:[0,-10,10,-8,8,-4,4,0]`, 0.5s), never a bare
  "Wrong" — FeedbackPanel shows "Almost!" with your answer vs the correct one,
  explanation, **Try again** (retry keeps the item) and **Next**.
- **Hint**: Lightbulb button reveals the correct answer inline and disables
  submit.
- **No answer key**: open-ended types (speaking/roleplay/pattern-drill/
  comprehension) and missing answers are celebrated as correct (positive
  feedback + XP) — never a dead end.
- **Why?** button → `ExplanationModal` with step pages:
  Correct answer → Your attempt → Why it is correct → Common mistakes →
  Example sentences → Related concepts; keyboard Esc/←/→.

## Gamification (ProgressHeader + useGameStats)

- Persisted in localStorage under key `woodpacker:game-stats`.
- Stats: XP, streak (days), level, daily goal + progress bar, solved,
  mistakes, consecutive correct.
- `addXp(xp, practice, perfect)` → updates stats, fires badge toasts.
- Badges (threshold-based): First Lesson (1), Week Wonder (7-day streak),
  Perfect Score (10 first-try), Grammar Master (50), Vocab Collector (50),
  Listening Pro (30), Speaker (10).
- Practice dimensions: vocabulary, grammar, listening, speaking, reading,
  other — attribution for XP and badge progress.

## Accessibility & motion

- Keyboard nav: `←`/`→` prev/next, `Enter` submit, `1–9` option select
  (skips TEXTAREA/INPUT; disabled while explanation modal open).
- `aria-live="polite"` sr-only feedback region.
- `MotionConfig reducedMotion="user"`; `prefers-reduced-motion` and
  `prefers-contrast: more` CSS in `globals.css`.

## Source files

- `src/components/exercises/FlashcardDeck.tsx` — the deck itself.
- `src/components/exercises/ExerciseSession.tsx` / `ExerciseCard.tsx` — legacy
  session variant used by `/cycles/[cycle]`.
- `src/components/exercises/FeedbackPanel.tsx`, `ExplanationModal.tsx`,
  `SentenceBuilder.tsx`, `GapFiller.tsx`, `WordBank.tsx`, `VoiceRecorder.tsx`,
  `Avatar.tsx`, `ProgressHeader.tsx`, `Confetti.tsx`, `XPReward.tsx`.
- `src/lib/exercise-config.ts` — type → title/XP/dimension/emotion + badges.
- `src/lib/types/exercise.ts` — `PremiumExercise`, `GameStats`, `Badge`.
- `src/lib/useGameStats.ts` — XP/streak/goal/badge persistence.
- `src/lib/exercise-validation.ts` — extraction validation rules.
- `src/lib/exercise-helpers.ts` — `normalizeAnswer`, `shuffle`, `wordBankFromAnswer`.
- `src/app/exercises/[id]/play/page.tsx` — play page wiring (ProgressHeader,
  `onResult` → `addXp`).
# Transform All Exercises Into a Premium Duolingo-Style Learning Experience

## Role Definition

You are a **Senior Product Designer**, **UX Researcher**, and **Frontend Architect**.

---

## Core Objective

Completely redesign every exercise in the application to make learning feel:

- **Fun** — never like a worksheet or form
- **Addictive** — driven by progress loops and rewards
- **Game-like** — interactive challenges, mini-games, learning missions
- **Visually rewarding** — animations, feedback, confetti, XP gains
- **Extremely easy to understand** — task must be clear within 1 second
- **Mobile-first** — touch-friendly, centered, large targets
- **Suitable for daily repetition** — optimized for the Woodpecker Method

**User journey per exercise:** Learn → Answer → Feedback → Explanation → Reward → Next Challenge

---

## Design Philosophy

### Current State (Problem)
- Exercises feel like static forms
- Plain input fields for translations
- Multiple choice lists are boring
- No personality, no life

### Target State (Solution)
- Every exercise is an **interactive challenge**
- Every answer feels like a **mini-game**
- Every correct answer triggers **celebration**
- Every wrong answer provides **constructive guidance**

---

## Visual Direction

### Color Palette

#### Background
- **Dark navy** — primary background
- **Deep charcoal** — secondary surfaces
- **Soft gradients** — subtle depth and dimension

#### Accent Colors
| Use Case        | Color          | Hex       |
|-----------------|----------------|-----------|
| Primary accent  | Purple         | `#A855F7` |
| Positive action | Lime Green     | `#84CC16` |
| Secondary       | Sky Blue       | `#38BDF8` |

#### Feedback Colors
| Feedback Type | Color |
|---------------|-------|
| Success       | Green |
| Error         | Red   |
| Warning       | Amber |

### Typography

**Rule: Headings dominate the screen.**

User must understand the task within 1 second.

#### Example Challenge Titles (Large, Bold)
- `"Write this in English"`
- `"Which word means car?"`
- `"Choose the correct answer"`
- `"Listen and repeat"`
- `"Arrange the words"`
- `"Match the words"`

---

### Card Design

Every exercise renders inside a large, centered card.

#### Requirements
| Property           | Value                |
|--------------------|----------------------|
| Corner radius      | 24px +              |
| Shadow             | Soft, elevated       |
| Glassmorphism      | Where appropriate    |
| Spacing            | Large (comfortable)  |
| Transitions        | Smooth, 60fps        |

**No cramped layouts.** Everything breathes.

---

## Exercise Transformation Rules

### 1. Translation Exercise

#### Current
Plain text input field — feels like filling a form.

#### Transformed: Interactive Sentence Builder

**Layout:**
1. **Challenge title** — e.g., `"Write this in English"`
2. **Character/avatar** — friendly illustration (Duolingo-style)
3. **Audio playback button** — 🔊
4. **Source sentence** — `"Ja, das ist mein Auto."`
5. **Word bank chips** — draggable/tappable words
6. **Answer area** — auto-spacing slots

**Interaction:**
- Drag and drop words from bank to answer area
- Tap-to-select words (mobile friendly)
- Animated placement of word chips
- Auto-spacing between built words
- Word chip hover effects (subtle scale + shadow)

**Correct Answer Feedback:**
- Confetti burst (purple + lime)
- Green glow around the card
- XP animation floating up (+10 XP)

**Wrong Answer Feedback:**
- Gentle shake animation
- Hint system: tap to reveal one word placement
- Show correct answer with explanation

---

### 2. Vocabulary Recognition

#### Current
Boring multiple choice list.

#### Transformed: Visual Choice Cards

**Layout:**
1. **Challenge title** — e.g., `"Which one of these is 'car'?"`
2. **Question prompt** — clear, bold

**Display:**
- **3–4 visual choice cards**
- Each card has:
  - Large illustration (image)
  - Vocabulary label underneath

**Card States:**
- **Default** — neutral border
- **Selected (correct)** — green border + success animation
- **Selected (incorrect)** — red border + explanation overlay
- **Unselected** — dimmed slightly

**Feedback:**
- Correct card pulses green
- Incorrect card shows explanation: `"This is 'house'. The car is in another image."`

---

### 3. Listening Exercises

#### Transformed: Audio-Centered Experience

**Layout:**
1. **Challenge title** — e.g., `"Listen and repeat"`
2. **Large play button** — center stage, pulsing gently
3. **Waveform visualization** — animated audio wave
4. **Replay button** — ↻
5. **Speed controls** — 0.5x, 0.75x, 1x, 1.25x, 1.5x

**After Listening — Choose Interaction Mode:**

| Mode | Description                                  |
|------|----------------------------------------------|
| ①     | Multiple choice — 4 visual options           |
| ②     | Sentence reconstruction — drag words         |
| ③     | Dictation — type what you heard              |

**Audio is the primary element.** Visuals support, never compete.

---

### 4. Speaking Exercises

#### Transformed: Duolingo-Style Speaking Tasks

**Layout:**
1. **Avatar** — friendly character, center
2. **Prompt sentence** — what the user should say
3. **Microphone button** — large, pulsing

**States:**
| State            | Visual Description                              |
|------------------|-------------------------------------------------|
| Idle             | Microphone dim, waiting                         |
| Listening        | Microphone glows sky blue, waveform animates     |
| Processing       | Spinner or "listening..." text                   |
| Correct          | Green glow, checkmark, avatar celebrates         |
| Needs Improvement| Amber glow, suggestion text, retry option        |

**Animations:**
- Pulsing microphone (subtle scale loop)
- Live voice waveform visualization
- Real-time transcription of user's speech

**Feedback Examples:**
- `"Great pronunciation!"`
- `"Try the 'r' sound again."`
- `"Almost! Listen to the model again."`

---

### 5. Reading Comprehension

#### Transformed: Interactive Reading Cards

**Layout:**
1. **Challenge title** — `"Read and answer"`
2. **Passage card** — scrollable, large text

**Interactive Features:**
- Tap any word to see definition popup
- Double-tap to highlight (yellow)
- Inline translation toggle (source → target)
- Vocabulary labels appear on unfamiliar words

**Questions:**
- Appear **one at a time** (never show a list form)
- Each question is its own challenge card
- Swipe or tap "Next" to proceed

**Navigation:**
- Progress indicator: `2 / 5`
- Back button to review passage

---

### 6. Grammar Exercises

#### Transformed: Visual Sentence Blocks

**Example Task:** Arrange sentence in correct order.

**Layout:**
1. **Challenge title** — `"Arrange the words"`
2. **Sentence area** — empty slots with placeholder gaps
3. **Word blocks** — draggable tiles below

**Word Blocks (Draggable):**
| Block Type  | Color         |
|-------------|---------------|
| Subject     | Purple        |
| Verb        | Lime Green    |
| Object      | Sky Blue      |

**Interaction:**
- Drag blocks to reorder
- Snap into correct position
- Visual confirmation when order is correct

**Feedback:**
- Correct: blocks lock in place, green glow, XP reward
- Incorrect: gentle shake, hint reveals correct word position

---

### 7. Matching Exercises

#### Transformed: Game Board

**Layout:**
1. **Challenge title** — `"Match the words"`
2. **Game board** — grid of cards (4×4 or 3×4)
3. **Matching mode** — choose before starting:

| Mode            | Pair Type                     |
|-----------------|-------------------------------|
| Word ↔ Meaning  | Text word ↔ Text definition   |
| Word ↔ Audio    | Text word ↔ 🔊 play button    |
| Word ↔ Image    | Text word ↔ Illustration      |

**Interaction:**
- Tap card to reveal/flip
- Tap second card to attempt match
- Animated line draws between matched pair

**Success Animation:**
- Matched cards fade out with a pop
- Particle effects on match
- "All matched!" celebration at the end

---

### 8. Fill In The Blank

#### Transformed: Word Bank + Drag/Drop

**Layout:**
1. **Challenge title** — `"Complete the sentence"`
2. **Sentence** — text with clearly visible **visual gaps** (underlined boxes)
3. **Word bank** — chips below the sentence

**Gap Design:**
- Underlined, dashed border
- Subtle pulsing to draw attention
- Correct word slot expands to fill space

**Interaction:**
- Drag word chip to gap
- Or tap chip, then tap gap
- Auto-snap to correct position

**Correct:**
- Gap fills with smooth transition
- Chip disappears from bank
- Green highlight

**Incorrect:**
- Chip bounces back
- Gentle shake of the gap
- Hint available

---

## Feedback System

### Every exercise must have **immediate** feedback.

#### Correct Answer
| Element                | Detail                                    |
|------------------------|-------------------------------------------|
| **Panel**              | Green success overlay on card             |
| **Icon**               | ✅ Large checkmark                        |
| **XP**                 | `+10 XP` floating up animation            |
| **Reinforcement**      | Random positive phrase (see list below)   |

**Positive Reinforcement Messages:**
- `"Excellent!"`
- `"Perfect!"`
- `"Nice work!"`
- `"You got it!"`
- `"Awesome!"`
- `"Nailed it!"`
- `"Keep going!"`

#### Incorrect Answer
| Element            | Detail                                              |
|--------------------|-----------------------------------------------------|
| **Show answer**    | Correct answer appears with highlight                |
| **Explain why**    | Brief explanation modal triggers automatically       |
| **Encourage retry**| `"Try again! You've got this!"`                      |

**Never** simply display: `"Wrong"`

---

## Explanation Modal

Inspired by the third reference screenshot.

**Trigger:** "Why?" button appears after answering (correct or incorrect).

### Modal Design
| Property          | Value                          |
|-------------------|--------------------------------|
| Size              | Large dialog (90vw max)        |
| Position          | Centered, elevated             |
| Corner radius     | 20px                           |
| Background        | Glassmorphic blur              |
| Close             | X button + swipe down to close |

### Content Structure
1. **Correct Answer** — large, highlighted text
2. **Why It Is Correct** — step-by-step breakdown
3. **Common Mistakes** — what learners typically get wrong
4. **Example Sentences** — additional context
5. **Related Concepts** — links to related exercises

### Visual Enhancements
- **Highlighted keywords** — color-coded
- **Syntax coloring** — grammar parts colored differently
- **Interactive examples** — tap to hear pronunciation

### Navigation
- **Previous / Next** buttons (pagination)
- Progress indicator: `1 / 3`
- Swipe left/right to navigate

---

## Gamification Layer

Every exercise supports these game mechanics:

### XP Rewards
- Base XP per exercise: +5 to +15
- Streak bonus: +1 XP per consecutive day
- Perfection bonus: +5 XP for no mistakes

### Streaks
- 🔥 Visual flame counter
- Daily reminder notifications
- Streak freeze (premium feature)
- "Don't break your streak!" message

### Daily Goals
- Target: 10 XP, 20 XP, 50 XP (adaptive)
- Progress bar fills as user completes exercises
- Celebration animation when goal met

### Progress Bars
- **Per-exercise:** how many questions left
- **Per-session:** total session XP progress
- **Per-week:** weekly streak progress

### Achievement Badges
| Badge           | Requirement              |
|-----------------|--------------------------|
| First Lesson    | Complete 1 exercise      |
| Week Wonder     | 7-day streak             |
| Perfect Score   | 10 exercises with 100%   |
| Grammar Master  | Complete 50 grammar tasks|
| Listening Pro   | Complete 30 listening    |
| Speaker         | 10 speaking exercises     |

### Achievement Toast
- Appears at top of screen
- Auto-dismiss after 3s
- Tap to view badge collection

---

## Motion Design (Framer Motion)

### Animations to Implement
| Animation             | Trigger                        | Details                              |
|-----------------------|--------------------------------|--------------------------------------|
| Card entrance         | Exercise loads                 | Scale from 0.8, fade in, 300ms       |
| Card exit             | Next exercise                  | Scale to 0.8, fade out, 200ms        |
| Success bounce        | Correct answer                 | Scale 1 → 1.1 → 1, spring            |
| Button hover          | Mouse hover                    | Scale 1.05, shadow increase          |
| Progress updates      | XP gain                        | Number rolls up, then settles        |
| Modal transitions     | Open/close explanation modal   | Opacity + scale, 250ms ease-in-out   |
| Word chip placement   | Drag to answer                 | Fly to position, slight rotation     |
| Confetti              | Correct answer                 | 50 particles, 2s duration            |

### Performance Target
- **60fps** smooth interactions
- All animations use `transform` and `opacity` (GPU-accelerated)
- Reduce motion: respect `prefers-reduced-motion`

---

## Accessibility Requirements

| Requirement              | Implementation                      |
|--------------------------|-------------------------------------|
| Keyboard navigation      | Tab-index, focus rings              |
| Screen reader support    | `aria-label`, `role`, `aria-live`   |
| High contrast mode       | CSS variables for theme switching   |
| Reduced motion support   | `@media (prefers-reduced-motion)`   |
| Colorblind-friendly      | Not color-only indicators           |

---

## Technical Requirements

### Stack
- **Next.js 16** — App Router
- **TypeScript** — Strict typing
- **Tailwind CSS v4** — Utility-first styling
- **shadcn/ui** — Component primitives
- **Framer Motion** — Animations
- **Lucide Icons** — Icon set

### Reusable Components to Create

| Component          | Purpose                                |
|--------------------|----------------------------------------|
| `ExerciseCard`     | Wrapper card with consistent styling   |
| `WordBank`         | Draggable/tappable word chips          |
| `AudioPlayer`      | Playback + waveform + speed controls   |
| `SpeakingRecorder` | Mic + recording + transcription         |
| `FeedbackPanel`    | Success/error feedback overlay         |
| `ExplanationModal` | Why? modal with step-by-step guidance  |
| `ProgressHeader`   | XP, streak, progress bar at top        |
| `XPReward`         | Floating XP animation                  |
| `AchievementToast` | Badge unlock notification              |
| `Avatar`           | Character illustration + emotions      |
| `ChallengeTitle`   | Large bold instruction heading         |
| `SentenceBuilder`  | Translation/drag-and-drop answer area  |
| `ChoiceCard`       | Vocabulary/visual multiple choice      |
| `SentenceBlocks`   | Grammar drag-and-drop sentence tiles   |
| `GameBoard`        | Matching exercise grid                 |
| `GapFiller`        | Fill-in-the-blank with word bank       |

---

## Existing Exercise Types Mapping

| Current Type              | New Component       | Transformation Summary                          |
|---------------------------|---------------------|-------------------------------------------------|
| `translation`             | `SentenceBuilder`   | Input → drag-and-drop word bank                 |
| `multiple_choice`         | `ChoiceCard`        | List → visual cards with images                 |
| `listening`               | `AudioPlayer` + mode| Text prompt → audio-first with waveform         |
| `speaking`                | `SpeakingRecorder`  | Text field → real mic + transcription           |
| `comprehension`           | `SentenceBlocks`    | Form → interactive reading with tap highlights  |
| `grammar`                 | `SentenceBlocks`    | Static → drag-and-drop sentence arrangement     |
| `pattern_drill`           | `GameBoard`         | — → matching game board                         |
| `recall`                  | `GapFiller`         | Plain input → word bank drag-and-drop           |
| `assessment`              | `ChoiceCard`        | Form-style → visual challenge cards             |

---

## Final Goal

Every exercise in Woodpacker should feel like a **premium language-learning game** rather than a traditional educational platform.

Users should experience:

> Learn → Answer → Feedback → Explanation → Reward → Next Challenge

with minimal friction, maximum engagement, and strong motivation for daily repetition using the **Woodpecker Method**.

---

## Reference Inspiration Sources

| Platform     | Element to Borrow                          |
|--------------|---------------------------------------------|
| Duolingo     | Gamification, streaks, character avatars    |
| Brilliant    | Interactive challenges, visual explanations |
| Khan Academy | Progress tracking, badges, clarity         |
| Elevate      | Micro-games, brain training feel            |
| Mimo         | Mobile-first, bite-sized challenges          |
| SoloLearn    | Community elements, XP, streaks             |

---

## File Conventions

- All components live in `src/components/exercises/`
- Types in `src/lib/types/exercise.ts`
- Exercise configs in `src/lib/exercise-config.ts`
- Animations config in `src/lib/animations.ts`
- Avatar assets in `src/assets/avatars/`
- Illustration assets in `src/assets/illustrations/`

---

## Next Steps

1. Build `ExerciseCard` base component
2. Build `WordBank` and `SentenceBuilder` (covers translation + fill-in-blank)
3. Build `ChoiceCard` (covers multiple choice + vocabulary)
4. Build `AudioPlayer` (covers listening)
5. Build `SpeakingRecorder` (covers speaking)
6. Build `FeedbackPanel` + `XPReward`
7. Build `ExplanationModal`
8. Build `ProgressHeader` + `AchievementToast`
9. Build `Avatar` component
10. Integrate all into existing exercise flow
11. Test on mobile viewport sizes
12. Add accessibility audit

---

## Implementation Status (Current Code)

This spec is the design target; the current implementation is documented in
`Context Files/FLASHCARD_CHARACTERISTICS.md`. Status of the sections above:

| Section | Status |
| --- | --- |
| Color palette / card design | **Built** — dark glass theme (`--color-background #0C0C0C`, primary `#10B981`, accent-lime), `.glass-card`, rounded-[28px] card |
| Translation → SentenceBuilder | **Built** — tap word chips into slots (`FlashcardDeck`) |
| Vocabulary → visual choice cards | **Built** — lettered option tiles (A/B/C/D) |
| Listening → audio-centered | **Built** — waveform, replay, speed 0.5–1.5×, transcript toggle, mode select (choice / reconstruct / dictation), TTS |
| Speaking → recorder | **Built** — `VoiceRecorder` (MediaRecorder) with preview + re-record |
| Reading comprehension | **Built** — passage box + question (tap-to-translate roadmap) |
| Grammar → sentence blocks | **Built** — `GapFiller` for fill-blank (pattern-drill matching board is roadmap) |
| Matching → GameBoard | **Roadmap** — `GameBoard` component exists but is not wired into the deck |
| Feedback system | **Built** — green glow + success bounce + confetti + XP; shake + hint + "Why?" modal; never "Wrong" |
| Explanation modal | **Built** — step pages: Correct answer → Your attempt → Why → Common mistakes → Example sentences → Related concepts |
| Gamification | **Built** — XP (+5 perfect bonus), streak, daily goal, badges, toasts via `useGameStats` |
| Motion design | **Built** — Framer Motion, `MotionConfig reducedMotion="user"` |
| Accessibility | **Built** — keyboard nav (←/→/Enter/1–9), `aria-live`, `prefers-contrast: more`, reduced motion |

Layout note: the practice deck uses a **viewport-fixed layout** — the page never
scrolls; the card scrolls internally (`overflow-y-auto`). The Cycles pages
(`/cycles`, `/cycles/[cycle]`) keep their normal page-scroll layout.

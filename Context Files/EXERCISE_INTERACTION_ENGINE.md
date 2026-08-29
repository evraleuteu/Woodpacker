# TASK: Replace Generic Exercise Input With Exercise-Type-Aware Interactions

You are working on the Woodpacker language-learning SaaS application.

The current exercise UI uses a generic text input:

    "Type your answer..."

with a large dark input box and a green check button.

This is NOT acceptable as the default interaction model.

I want Woodpacker to use a modern, exercise-aware interaction system inspired by the interaction patterns of language-learning applications such as Duolingo, but DO NOT copy Duolingo's proprietary visual design, assets, branding, or exact UI.

The core principle is:

    THE EXERCISE TYPE MUST DETERMINE HOW THE USER ANSWERS.

Do not show a generic text field for every exercise.

The system must dynamically render the appropriate interaction component based on the exercise's semantic type.

==================================================
1. PRIMARY OBJECTIVE
==================================================

Build a reusable:

    ExerciseInteractionEngine

that receives an exercise definition and determines the correct interaction UI.

Example:

    exercise.type = "multiple_choice"

→ render MultipleChoiceInput

    exercise.type = "fill_blank"

→ render FillBlankInput

    exercise.type = "word_order"

→ render WordOrderInput

    exercise.type = "translation"

→ render TranslationInput

    exercise.type = "matching"

→ render MatchingInput

    exercise.type = "listening"

→ render ListeningInput

    exercise.type = "speaking"

→ render SpeakingInput

    exercise.type = "image_choice"

→ render ImageChoiceInput

etc.

The generic text input should only appear when the exercise genuinely requires free-form text.

==================================================
2. FIRST: AUDIT THE EXISTING SYSTEM
==================================================

Before modifying code:

1. Inspect the entire existing exercise rendering architecture.
2. Identify:
   - exercise data model
   - exercise type definitions
   - exercise generation pipeline
   - exercise API
   - exercise page
   - answer submission logic
   - validation logic
   - scoring logic
   - feedback logic
   - progress tracking
   - audio handling
   - image handling
   - existing components
3. Find every place where the generic:
   "Type your answer..."
   input is rendered.
4. Determine whether the backend already contains exercise types that can be mapped to specific interactions.
5. Reuse existing architecture wherever possible instead of creating duplicate systems.

DO NOT start by rewriting the entire exercise system.

First understand the current implementation and then integrate the new interaction engine cleanly.

==================================================
3. CREATE A CENTRAL EXERCISE TYPE SYSTEM
==================================================

Create or improve a canonical exercise type registry.

For example:

type ExerciseType =
  | "multiple_choice"
  | "single_choice"
  | "multiple_select"
  | "fill_blank"
  | "cloze"
  | "word_order"
  | "sentence_builder"
  | "translation"
  | "free_text"
  | "matching"
  | "pair_matching"
  | "listening"
  | "listening_choice"
  | "dictation"
  | "speaking"
  | "pronunciation"
  | "image_choice"
  | "image_label"
  | "true_false"
  | "flashcard"
  | "short_answer";

Use the actual exercise types already present in Woodpacker where possible.

Do NOT blindly introduce types that the backend cannot support.

Create a mapping:

ExerciseType
        ↓
Interaction Component
        ↓
Answer Representation
        ↓
Validation Strategy

This mapping must be centralized rather than scattered throughout the application.

==================================================
4. INTERACTION TYPES
==================================================

Implement the following interaction patterns where applicable.

--------------------------------------------------
A. SINGLE CHOICE
--------------------------------------------------

For questions with one correct answer:

Example:

    Was bedeutet "Haus"?

    ○ house
    ○ car
    ○ school
    ○ book

Render large selectable answer cards/buttons.

Requirements:

- No text input.
- Entire option should be clickable.
- Clear selected state.
- Keyboard accessible.
- Only one option can be selected.
- Selecting an answer should NOT immediately submit unless the existing product logic explicitly requires it.
- Continue/check button becomes available after selection.
- Preserve selected state.
- Provide correct/incorrect feedback after submission.

--------------------------------------------------
B. MULTIPLE CHOICE / MULTI-SELECT
--------------------------------------------------

Example:

    Which words are nouns?

    [Haus]
    [laufen]
    [Katze]
    [schnell]

Allow multiple selections.

Use selectable chips/cards.

The user must be able to:
- select
- deselect
- review selections
- submit

--------------------------------------------------
C. TRUE / FALSE
--------------------------------------------------

Use two large answer cards:

    TRUE

    FALSE

Do not use a text field.

--------------------------------------------------
D. FILL IN THE BLANK
--------------------------------------------------

Example:

    Ich ___ heute Deutsch.

Instead of one giant generic textbox, render the sentence naturally:

    Ich [ ______ ] heute Deutsch.

The input should visually belong to the sentence.

Support multiple blanks where necessary:

    Ich [____] heute [____].

Each blank should have its own answer state.

If the answer is selected from a finite set, use selectable word options instead of free text.

--------------------------------------------------
E. WORD BANK
--------------------------------------------------

For exercises where the learner constructs a sentence from provided words:

    Ich
    heute
    Deutsch
    lerne

User taps:

    Ich → lerne → heute → Deutsch

The selected words move into an answer area.

Requirements:

- word chips/cards
- selected words visibly move or become disabled
- allow removing a selected word
- support repeated words
- preserve ordering
- support keyboard accessibility
- prevent accidental duplication bugs
- validate against expected answer(s)

--------------------------------------------------
F. WORD ORDER / SENTENCE BUILDER
--------------------------------------------------

Example:

    "heute / ich / Deutsch / lerne"

The learner constructs:

    Ich lerne heute Deutsch.

Use draggable/tappable word blocks.

Prefer tap-to-add for mobile and touch interfaces.

Support drag-and-drop as an enhancement, not as the only interaction.

The system must handle:
- reordered words
- duplicate words
- punctuation
- alternative valid answers

--------------------------------------------------
G. TRANSLATION
--------------------------------------------------

Example:

    Translate:

    "I am learning German."

For translation exercises, free text IS appropriate.

But make the input specifically designed for translation.

Requirements:

- comfortable text area
- language-aware placeholder
- optional word hints
- keyboard-friendly
- submit with Enter/Ctrl+Enter where appropriate
- display source sentence prominently
- optionally display hints
- show expected/corrected answer after submission
- support tolerant validation

Do NOT use the generic "Type your answer..." component.

Create:

    TranslationInput

--------------------------------------------------
H. MATCHING
--------------------------------------------------

Example:

    Match:

    Haus       → house
    Katze      → cat
    Hund       → dog

Create an interactive matching component.

Possible interaction:

1. User selects left item.
2. User selects corresponding right item.
3. Connection is created.
4. Matched items become visually linked/disabled.

Support:
- keyboard navigation
- touch
- desktop
- removing/replacing a match
- validation

Do not require users to type answers.

--------------------------------------------------
I. LISTENING
--------------------------------------------------

Example:

    Listen and choose what you heard.

Render:

    [ 🔊 Play ]

then answer choices.

Support:
- play
- replay
- playback state
- optional slower playback
- audio progress
- answer selection

Do not show a text field unless the exercise is explicitly a dictation exercise.

--------------------------------------------------
J. DICTATION
--------------------------------------------------

Example:

    [ 🔊 Listen ]

    Type what you hear.

Here a text input is appropriate.

However, make it a dedicated:

    DictationInput

with:
- audio player
- replay
- answer input
- optional hint
- speech/audio state
- validation
- typo tolerance where appropriate

--------------------------------------------------
K. SPEAKING
--------------------------------------------------

For speaking exercises:

    Say:

    "Ich wohne in Deutschland."

Show:

    🎤 Hold to speak

or:

    [ Start recording ]

Then:

    [ Stop ]

After recording:

    [ Try again ]    [ Continue ]

Display:
- microphone permission state
- recording duration
- waveform or recording indicator
- playback
- retry
- processing state
- pronunciation feedback

Do NOT show a text input as the primary interaction.

Integrate with the existing Speaking Mastery Engine if available.

--------------------------------------------------
L. PRONUNCIATION
--------------------------------------------------

Similar to speaking, but explicitly focused on pronunciation.

Show:
- target phrase
- audio example
- record button
- recording state
- playback
- pronunciation result

Example:

    Listen

    "Guten Morgen."

    [ 🔊 ]

    Now say it:

    [ 🎤 Record ]

After evaluation:

    Pronunciation
    ████████░░ 82%

Do not expose raw technical evaluation data unless appropriate.

--------------------------------------------------
M. IMAGE CHOICE
--------------------------------------------------

Example:

    Which image represents "der Apfel"?

Display visual answer cards.

User selects an image.

Do not require typing.

Images must be properly sized and accessible.

--------------------------------------------------
N. IMAGE LABELING
--------------------------------------------------

If the exercise asks the learner to identify objects in an image:

    What is this?

    [ image ]

    [ apple ]

or:

    [ ______ ]

depending on the generated exercise.

Choose the interaction based on whether answers are finite or open-ended.

--------------------------------------------------
O. FLASHCARD / RECALL
--------------------------------------------------

For recall exercises:

Front:

    What is "Apfel" in English?

User attempts recall.

Then:

    Show answer

After revealing:

    [ I knew it ]
    [ I almost knew it ]
    [ I didn't know ]

This should integrate with the Woodpacker repetition/scheduling system.

==================================================
5. ADAPTIVE INTERACTION RULE
==================================================

The renderer must not determine interaction solely from whether an answer exists.

It must inspect:

    exercise.type

and, where necessary:

    exercise.inputMode
    exercise.answerOptions
    exercise.media
    exercise.expectedAnswer
    exercise.metadata

Example:

{
  "type": "multiple_choice",
  "prompt": "What does Haus mean?",
  "options": [
    "house",
    "car",
    "school",
    "book"
  ],
  "correctAnswer": "house"
}

→ MultipleChoiceInput

Another:

{
  "type": "translation",
  "prompt": "Translate this sentence.",
  "sourceText": "Ich lerne Deutsch.",
  "targetLanguage": "English"
}

→ TranslationInput

Another:

{
  "type": "word_order",
  "tokens": [
    "heute",
    "Deutsch",
    "ich",
    "lerne"
  ]
}

→ WordOrderInput

==================================================
6. EXERCISE INTERACTION ENGINE
==================================================

Create a central component similar to:

    <ExerciseInteraction
        exercise={exercise}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={handleSubmit}
        disabled={submitted}
    />

Internally:

    switch (exercise.type) {

      case "multiple_choice":
        return <MultipleChoiceInput ... />

      case "fill_blank":
        return <FillBlankInput ... />

      case "word_order":
        return <WordOrderInput ... />

      case "translation":
        return <TranslationInput ... />

      case "matching":
        return <MatchingInput ... />

      case "listening":
        return <ListeningInput ... />

      case "speaking":
        return <SpeakingInput ... />

      default:
        return <FallbackInput ... />
    }

The fallback must be intentional and rare.

It should NOT silently turn every unknown exercise into the current generic textbox.

Log unsupported exercise types so they can be fixed.

==================================================
7. ANSWER MODEL
==================================================

Create a normalized answer representation.

For example:

type ExerciseAnswer =
  | {
      type: "choice";
      value: string;
    }
  | {
      type: "multi_choice";
      values: string[];
    }
  | {
      type: "text";
      value: string;
    }
  | {
      type: "word_order";
      values: string[];
    }
  | {
      type: "matching";
      pairs: Array<{
        left: string;
        right: string;
      }>;
    }
  | {
      type: "speaking";
      audioUrl?: string;
    };

The UI component should own interaction mechanics.

The validation layer should own correctness.

Do not mix UI state with scoring logic.

==================================================
8. VALIDATION
==================================================

Separate:

    user interaction

from:

    answer validation

from:

    scoring

Example:

UI:

    User selects "house"

Answer:

    {
      type: "choice",
      value: "house"
    }

Validator:

    validateAnswer(exercise, answer)

Result:

    {
      correct: true,
      score: 1,
      feedback: ...
    }

This must work consistently across all exercise types.

Support:
- exact answers
- normalized text
- capitalization tolerance
- punctuation tolerance
- alternative valid answers
- word-order validation
- partial credit where appropriate

Do not make validation dependent on visual components.

==================================================
9. SUBMISSION UX
==================================================

The check/continue action should be consistent across exercise types, but the answer controls should vary.

Example:

Multiple choice:

    [ option A ]
    [ option B ]
    [ option C ]

                [ CHECK ]

Word order:

    [ Ich ] [ lerne ] [ Deutsch ]

                [ CHECK ]

Speaking:

    [ 🎤 Record ]

                [ CONTINUE ]

Translation:

    [ text area ]

                [ CHECK ]

Do not place a giant green circular check button beside every input.

The action should be part of the exercise flow.

==================================================
10. FEEDBACK STATE
==================================================

After submission, transform the interaction state.

Correct:

    ✓ Correct!

Incorrect:

    ✕ Not quite.

Show the correct answer when appropriate.

The feedback should be visually obvious but not overwhelming.

For example:

    ┌─────────────────────────────┐
    │ ✓ Correct!                  │
    │                             │
    │ Your answer: house         │
    └─────────────────────────────┘

Then:

    [ CONTINUE ]

Do not allow accidental resubmission after completion.

==================================================
11. DUOLINGO-LIKE INTERACTION PRINCIPLES
==================================================

Use the following principles inspired by modern language-learning UX:

- one clear task at a time
- large touch targets
- minimal cognitive load
- obvious selected states
- immediate interaction feedback
- progressive disclosure
- visual answer choices
- sentence construction using word blocks
- audio-first exercises when appropriate
- speaking exercises using microphone interaction
- clear success/failure feedback
- mobile-friendly interactions
- keyboard accessibility
- minimal unnecessary typing
- strong visual hierarchy

Do NOT copy:
- Duolingo logos
- exact colors
- exact illustrations
- proprietary assets
- exact screen layouts
- exact animations
- proprietary UI components

Woodpacker should have its own visual identity.

==================================================
12. WOODPACKER VISUAL LANGUAGE
==================================================

Maintain Woodpacker's existing design system.

Do NOT introduce:
- purple gradients
- excessive gradients
- generic AI-dashboard aesthetics
- giant input boxes
- unnecessary glassmorphism
- excessive shadows
- random colors for every component

Use:
- clean typography
- rounded cards
- strong hierarchy
- subtle borders
- restrained shadows
- accessible contrast
- clear states
- friendly educational UI

The interface should feel like a premium language-learning product.

==================================================
13. RESPONSIVE DESIGN
==================================================

The exercise system must work on:

- desktop
- tablet
- mobile

On mobile:
- answer cards should span most of the available width
- word chips should wrap naturally
- controls must be touch-friendly
- avoid tiny drag handles
- avoid horizontal overflow
- keyboard input must not break the layout

On desktop:
- constrain exercise width
- avoid enormous empty spaces
- maintain focus on the exercise

==================================================
14. ANIMATION
==================================================

Use subtle interaction animations.

Examples:

- selected answer slightly changes elevation/position
- word chip moves into answer area
- matching connection animates
- correct answer gets subtle confirmation
- incorrect answer gets subtle shake
- continue transition is smooth

Do NOT over-animate.

Animations must not interfere with accessibility.

Respect:

    prefers-reduced-motion

==================================================
15. ACCESSIBILITY
==================================================

Every interaction must support keyboard navigation where applicable.

Requirements:

- semantic buttons
- proper labels
- visible focus states
- screen-reader labels
- sufficient contrast
- keyboard selection
- Enter/Space interaction
- accessible audio controls
- accessible microphone states

Do not build interactions that only work with mouse/touch.

==================================================
16. STATE MACHINE
==================================================

The exercise UI should have explicit states:

    idle
      ↓
    answering
      ↓
    ready_to_submit
      ↓
    submitting
      ↓
    correct / incorrect
      ↓
    completed

For example:

    IDLE
       ↓
    USER_SELECTS
       ↓
    ANSWER_READY
       ↓
    CHECKING
       ↓
    FEEDBACK
       ↓
    CONTINUE

Do not rely on scattered boolean flags such as:

    isLoading
    isCorrect
    hasAnswered
    showAnswer
    isSubmitted

when a proper state model is more appropriate.

Use the existing application state architecture if one already exists.

==================================================
17. COMPONENT ARCHITECTURE
==================================================

Create a reusable component structure similar to:

components/
  exercises/
    ExerciseRenderer.tsx
    ExerciseInteraction.tsx
    ExercisePrompt.tsx
    ExerciseFeedback.tsx
    ExerciseProgress.tsx

    interactions/
      MultipleChoiceInput.tsx
      MultiChoiceInput.tsx
      TrueFalseInput.tsx
      FillBlankInput.tsx
      WordBankInput.tsx
      WordOrderInput.tsx
      SentenceBuilderInput.tsx
      TranslationInput.tsx
      MatchingInput.tsx
      ListeningInput.tsx
      DictationInput.tsx
      SpeakingInput.tsx
      PronunciationInput.tsx
      ImageChoiceInput.tsx
      ImageLabelInput.tsx
      FlashcardInput.tsx
      FreeTextInput.tsx

    shared/
      AnswerOption.tsx
      WordChip.tsx
      AudioPlayer.tsx
      RecordingButton.tsx
      CheckButton.tsx
      ContinueButton.tsx

Adapt this structure to the existing project conventions.

Do not duplicate components that already exist.

==================================================
18. GENERATOR COMPATIBILITY
==================================================

IMPORTANT:

The exercise generator must produce enough metadata for the frontend to render the correct interaction.

If the current generated exercise JSON is insufficient, update the schema.

For example:

{
  "id": "...",
  "type": "word_order",
  "prompt": "Build the sentence",
  "difficulty": "A2",
  "targetLanguage": "German",
  "tokens": [
    {
      "id": "1",
      "text": "Ich"
    },
    {
      "id": "2",
      "text": "lerne"
    },
    {
      "id": "3",
      "text": "Deutsch"
    }
  ],
  "solution": {
    "acceptedOrders": [
      ["1", "2", "3"]
    ]
  }
}

The frontend should not have to guess what kind of exercise it is.

==================================================
19. EXERCISE GENERATION RULE
==================================================

Improve the exercise generation pipeline if necessary so that exercises are generated with appropriate interaction modes.

Example:

A question asking:

    "What does 'Apfel' mean?"

should preferably become:

    multiple_choice

rather than:

    free_text

A sentence reconstruction exercise should become:

    word_order

A listening recognition exercise should become:

    listening_choice

A pronunciation task should become:

    speaking/pronunciation

A translation exercise should become:

    translation

A recall exercise should become:

    flashcard/recall

The goal is to minimize unnecessary typing.

==================================================
20. DO NOT BREAK EXISTING DATA
==================================================

Existing exercises must continue to work.

If old exercises use legacy types:

    text
    question
    answer

create a compatibility layer.

For example:

legacy exercise
      ↓
exercise type normalization
      ↓
new interaction engine

Do not require all existing database records to be manually migrated immediately unless absolutely necessary.

==================================================
21. TESTING
==================================================

Create tests for every interaction type.

At minimum test:

1. Multiple choice
2. Multi-select
3. True/false
4. Fill blank
5. Word bank
6. Word order
7. Translation
8. Matching
9. Listening
10. Dictation
11. Speaking
12. Image choice
13. Free text
14. Legacy exercise compatibility

Test:

- rendering
- selection
- deselection
- answer state
- submission
- validation
- correct feedback
- incorrect feedback
- continue
- reset/retry
- keyboard interaction
- mobile layout where practical

==================================================
22. IMPORTANT EDGE CASES
==================================================

Handle:

- no answer options
- empty answer
- duplicate word tokens
- multiple valid answers
- alternative word orders
- long translations
- punctuation differences
- capitalization differences
- missing audio
- missing image
- microphone permission denied
- audio loading failure
- network failure
- unsupported exercise type
- corrupted exercise JSON

Never crash the exercise page.

For unsupported exercises, show a controlled fallback and log the unsupported type.

==================================================
23. PERFORMANCE
==================================================

Do not load heavy components unnecessarily.

For example:

- microphone functionality should be lazy-loaded
- audio components should not initialize until required
- image assets should be optimized
- exercise interactions should not cause unnecessary page-wide rerenders

Keep the exercise experience fast.

==================================================
24. PRODUCT PRINCIPLE
==================================================

The most important rule:

    DO NOT ASK THE USER TO TYPE WHEN THE EXERCISE DOES NOT REQUIRE TYPING.

Examples:

Vocabulary recognition
→ choice

Vocabulary recall
→ flashcard/recall

Sentence construction
→ word blocks

Listening recognition
→ audio + choices

Pronunciation
→ microphone

Matching
→ matching interaction

Image vocabulary
→ image selection

Translation
→ text input

Dictation
→ text input + audio

Open-ended production
→ text input

This is the fundamental change I want.

==================================================
25. REMOVE THE CURRENT GENERIC UI
==================================================

The current UI shown in the attached reference image has:

- huge dark rectangular input
- "Type your answer..."
- large circular green check button

Do NOT preserve this as the default exercise interface.

Replace it with context-specific interactions.

The old component may remain only as the dedicated:

    FreeTextInput

or:

    TranslationInput

when appropriate.

It must NOT be rendered for every exercise.

==================================================
26. FINAL USER EXPERIENCE
==================================================

The final experience should feel like:

    Open exercise
          ↓
    Understand the task immediately
          ↓
    Interact naturally
          ↓
    Submit/check
          ↓
    Receive immediate feedback
          ↓
    Continue

The user should never wonder:

    "Why am I being asked to type this?"

The interface itself should communicate how the exercise should be solved.

==================================================
27. IMPLEMENTATION PROCESS
==================================================

Follow this implementation sequence:

PHASE 1
Audit existing exercise architecture.

PHASE 2
Create/normalize exercise type definitions.

PHASE 3
Create ExerciseInteractionEngine.

PHASE 4
Implement the highest-value interactions:

    MultipleChoice
    TrueFalse
    FillBlank
    WordBank
    WordOrder
    Translation
    Matching
    Listening
    Speaking

PHASE 5
Connect interactions to existing answer submission and validation.

PHASE 6
Update exercise generator/schema where necessary.

PHASE 7
Implement feedback states.

PHASE 8
Add accessibility and responsive behavior.

PHASE 9
Add tests.

PHASE 10
Remove the generic input from all inappropriate exercise types.

==================================================
28. DEFINITION OF DONE
==================================================

The task is NOT complete if the UI merely looks different.

It is complete only when:

✓ Exercise type determines interaction type.

✓ Multiple-choice exercises use selectable options.

✓ Word-order exercises use word blocks.

✓ Matching exercises use matching interactions.

✓ Listening exercises use audio interaction.

✓ Speaking exercises use microphone interaction.

✓ Translation exercises use a dedicated translation input.

✓ Fill-blank exercises display inputs inside the sentence.

✓ Image exercises use visual selection.

✓ Free-text input is only used when semantically appropriate.

✓ Answer validation is independent from UI components.

✓ Existing exercises continue working.

✓ Legacy exercises are supported.

✓ Correct/incorrect feedback works consistently.

✓ Keyboard accessibility works.

✓ Mobile interaction works.

✓ No giant generic "Type your answer..." input appears on exercises where it does not belong.

✓ No unnecessary rewrite of unrelated Woodpacker functionality.

==================================================
29. BEFORE FINISHING
==================================================

After implementation:

1. Run the application.
2. Navigate through every exercise type.
3. Verify the actual rendered UI, not just the code.
4. Test answering each exercise.
5. Test correct and incorrect answers.
6. Test retry/continue.
7. Test mobile/responsive behavior.
8. Check browser console for errors.
9. Check API/network errors.
10. Check TypeScript errors.
11. Run the relevant test suite.
12. Fix any regressions.

Finally provide a concise implementation report containing:

- files changed
- components created
- exercise types supported
- backend/schema changes
- validation changes
- tests added
- remaining limitations
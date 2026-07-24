# Database Schema

## Users

- id
- email
- name
- subscription_plan
- created_at

## LearningMaterials

- id
- user_id
- title
- type
- language
- status

Types: Book, Notes, Slides, Audio, Mixed

## Chapters

- id
- material_id
- title
- position

## KnowledgeUnits

- id
- material_id
- title
- type
- content

## Exercises

- id
- knowledge_unit_id
- type
- difficulty

## Patterns

- id
- material_id
- pattern
- frequency

## AccentProfiles

- id
- user_id
- native_language
- target_accent
- overall_score

## PronunciationErrors

- id
- accent_profile_id
- phoneme
- severity

## WoodpeckerCycles

- id
- material_id
- cycle_number
- duration_days

## Progress

- id
- user_id
- exercise_id
- score
- attempts
- last_reviewed

## SpeakingSessions (NEW)

- id
- user_id
- material_id
- session_type
- score
- duration
- created_at

## SpeakingAttempts (NEW)

- id
- session_id
- prompt
- transcript
- feedback
- score

## SpeakingPatterns (NEW)

- id
- pattern
- mastery_score
- last_practiced

## SpeakingMastery (NEW)

- id
- user_id
- exercise_id
- mastery_level
- cycles_completed
- last_mastered
- needs_review

## SpeakingFeedback (NEW)

- id
- attempt_id
- pronunciation_score
- grammar_score
- fluency_score
- confidence_score
- meaning_score
- pattern_score
- overall_score

## PatternMastery (NEW)

- id
- pattern
- mastery_level
- total_attempts
- automaticity_score
- next_review
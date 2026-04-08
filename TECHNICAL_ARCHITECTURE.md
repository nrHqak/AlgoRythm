# AlgoRythm Technical Architecture

## 1. Project Overview

AlgoRythm is an interactive algorithm learning platform focused on Python code tracing, visualization, guided debugging, gamification, and daily retention loops.

The product has four core capabilities:

1. Execute and trace user-written Python algorithm code safely.
2. Convert execution into structured visualization and audio feedback.
3. Persist user learning history, progress, and game state in Supabase.
4. Support guided learning through AI mentor, curriculum tasks, daily quizzes, and a virtual pet.

## 2. System Architecture

The system is split into three main layers.

### 2.1 Frontend

Technology:

- React 18
- Vite
- React Router v6
- Plain CSS
- Supabase JS client

Responsibilities:

- authentication UI
- curriculum navigation
- code editor and step player
- chart rendering
- mentor chat
- profile analytics
- retention widgets: Algorithm Pet and Daily Quiz
- direct Supabase reads/writes for low-risk product state

### 2.2 Backend

Technology:

- FastAPI
- Python sandbox execution
- `sys.settrace` tracer
- Gemini integration
- NumPy-based complexity fitting
- Supabase Python client for privileged writes

Responsibilities:

- safe code execution
- trace generation
- algorithm classification
- complexity estimation
- mentor responses
- session save flow with streak and achievement logic
- demo data seeding

### 2.3 Data Layer

Technology:

- Supabase PostgreSQL
- Supabase Auth
- Supabase REST/JS client

Responsibilities:

- user identity
- profiles
- curriculum state
- sessions
- achievements
- mentor history
- pet state
- daily quiz attempts

## 3. Runtime Topology

### 3.1 Production Deployment

- Frontend: Vercel
- Backend: Render
- Database/Auth: Supabase

### 3.2 Integration Boundaries

- Frontend -> Backend
  - `/analyze`
  - `/complexity`
  - `/mentor`
  - `/curriculum`
  - `/session/save`

- Frontend -> Supabase directly
  - auth
  - profile reads
  - task progress
  - achievements reads
  - mentor messages
  - pet state
  - quiz attempts

- Backend -> Supabase with service role
  - session persistence
  - profile XP/level/streak updates
  - achievements award flow
  - demo seeding

## 4. Frontend Architecture

### 4.1 Entry and Routing

Key files:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

Routing model:

- `/` -> Landing
- `/auth` -> authentication
- `/learn` -> curriculum + daily ritual
- `/learn/:taskId` -> task-specific playground
- `/playground` -> free playground
- `/mentor` -> long-form AI mentor workspace
- `/profile` -> analytics and learning history

Protected routes use a route guard that redirects unauthenticated users to `/auth`.

### 4.2 State Model

State is split across focused hooks:

- `useAuth`
  - session and user state
  - sign-in / sign-up / sign-out
- `useProfile`
  - profile hydration
  - level calculation
  - profile refresh/update
- `useTracer`
  - `/analyze` request
  - trace result storage
- `usePlayer`
  - current step
  - play/pause/next/prev logic
- `useAudio`
  - Web Audio API event sounds
- `useAchievements`
  - toast notifications
- `useDNA`
  - computes profile radar metrics from sessions
- `usePet`
  - pet persistence and feed logic
- `useDailyQuiz`
  - daily quiz lifecycle, timer, XP reward flow
- `useLocale`
  - EN/RU dictionary state

### 4.3 Page Responsibilities

#### AuthPage

- email/password sign-in
- email/password registration
- demo account sign-in when configured

#### LearnPage

- curriculum loading
- task unlock state
- streak and XP snapshot
- Algorithm Pet widget
- Daily Quiz widget

#### PlaygroundPage

- code input
- trace execution
- algorithm detection display
- visual playback
- complexity analysis
- mentor interaction
- session save flow

#### MentorPage

- long-form AI chat
- recent session context
- compressed trace context

#### ProfilePage

- statistics
- session history
- achievements
- heatmap
- Algorithm DNA radar chart

## 5. Backend Architecture

### 5.1 FastAPI Application

Key file:

- `backend/main.py`

Main endpoints:

- `GET /`
- `GET /curriculum`
- `POST /analyze`
- `POST /complexity`
- `POST /mentor`
- `POST /session/save`

### 5.2 Analyze Pipeline

`POST /analyze` pipeline:

1. validate request
2. execute Python code in sandbox
3. build trace result
4. classify algorithm using AST features and trained model
5. return:
   - `steps`
   - `error`
   - `total_steps`
   - `truncated`
   - `algorithm_type`
   - `algorithm_confidence`

### 5.3 Complexity Pipeline

`POST /complexity` pipeline:

1. generate reversed arrays for sizes `[5, 10, 20, 40, 80]`
2. replace first list literal in source code
3. re-run trace for each size with larger trace budget
4. collect `total_steps`
5. fit candidate growth functions
6. return best complexity fit and confidence

Candidate models:

- `O(√n)`
- `O(log n)`
- `O(n)`
- `O(n log n)`
- `O(n²)`
- `O(n³)`

### 5.4 Mentor Pipeline

Key file:

- `backend/mentor.py`

Modes:

- reactive
- proactive
- free_chat

Behavior:

- constructs context from code, trace, error, and history
- uses Gemini to answer
- falls back to safe static prompts on Gemini failure

### 5.5 Session Save Pipeline

`POST /session/save` pipeline:

1. insert session row
2. load profile and related progress data
3. compute streak
4. evaluate eligible achievements
5. insert newly earned achievements
6. update total XP and level
7. return session id and earned achievements

## 6. Tracing and Sandbox Design

### 6.1 Sandbox

Key file:

- `backend/sandbox.py`

Execution model:

- compiles user code
- executes inside a separate daemon thread
- joins with a 2 second timeout

Import policy:

- blocked: `os`, `sys`, `subprocess`, `socket`, `shutil`, `pathlib`
- allowed: `math`, `random`, `collections`, `itertools`, `functools`

If timeout occurs:

- returns structured timeout error
- does not crash the process

### 6.2 Tracer

Key file:

- `backend/tracer.py`

Mechanism:

- uses `sys.settrace`
- records executed lines only for `<user_code>`
- deep-copies current array state
- snapshots locals
- extracts highlight indices

Current supported event types:

- `compare`
- `swap`
- `search`
- `found`
- `shift`
- `write`
- `step`
- `error`

Highlight extraction supports:

- `i`
- `j`
- `mid`
- `left`
- `right`
- `low`
- `high`
- `min_idx`
- `current`
- `pivot_idx`

Trace limits:

- normal runs: 300 steps
- complexity analysis: 25000 steps

### 6.3 Why `sys.settrace`

`sys.settrace` is used because it gives deterministic line-by-line execution visibility for arbitrary student code without requiring source transformation or a custom interpreter.

Tradeoff:

- simple and flexible
- slower than static instrumentation
- line-level semantics require heuristics to infer algorithm intent

## 7. Algorithm Classification

Key files:

- `backend/classifier.py`
- `backend/algo_classifier.pkl`

Classification strategy:

1. parse user code with Python AST
2. extract structural features
3. run trained model
4. map predicted label through label encoder

Feature examples:

- number of `for` loops
- number of `while` loops
- maximum nesting depth
- number of comparisons
- swap tuple presence
- `break` presence
- floor division presence
- `range(len(...))` usage
- number of subscript operations
- lines of code

Current model classes:

- `binary_search`
- `bubble_sort`
- `insertion_sort`
- `linear_search`
- `selection_sort`

This is an AST-based structural classifier, not an LLM classifier.

## 8. Visualization Architecture

### 8.1 Primary Visualizer

Key file:

- `frontend/src/components/VisualCanvas.jsx`

Model:

- 1D SVG bar chart
- one bar per array element
- bar height normalized to max absolute value
- highlighted bars use event color

This visual model is well-suited for:

- bubble sort
- selection sort
- insertion sort
- linear search
- binary search

It is not ideal for:

- graphs
- trees
- general dynamic programming tables

### 8.2 Audio Mapping

Key file:

- `frontend/src/hooks/useAudio.js`

Current sound mapping:

- `compare`
- `swap`
- `search`
- `found`
- `shift`
- `write`
- `error`

Audio is intentionally lightweight and event-driven, not continuous.

### 8.3 Step Playback

Key files:

- `frontend/src/hooks/usePlayer.js`
- `frontend/src/components/StepPlayer.jsx`

Playback model:

- fixed 600 ms interval
- manual prev/next
- auto-stop at end
- bounded by `total_steps`

## 9. Data Model

### 9.1 Core Tables

#### `profiles`

Purpose:

- user public profile
- XP
- level
- streak
- last active date

#### `sessions`

Purpose:

- stores each code execution

Fields used by application:

- `user_id`
- `code`
- `array_var`
- `trace`
- `error`
- `total_steps`
- `algorithm_type`
- `solved`
- `attempts`
- `xp_earned`
- `created_at`

#### `tasks`

Purpose:

- curriculum task registry

#### `task_progress`

Purpose:

- user status per task
- unlock/completion state
- attempts
- best steps
- XP earned

#### `achievements`

Purpose:

- static achievement catalog

#### `user_achievements`

Purpose:

- earned achievements per user

#### `mentor_messages`

Purpose:

- conversation log for mentor UI and future analytics

### 9.2 Retention Tables

#### `pet_profiles`

Purpose:

- algorithm pet state

Fields:

- `user_id`
- `pet_name`
- `hunger`
- `mood`
- `energy`
- `evolution_points`
- `last_fed_at`
- `updated_at`

#### `quiz_attempts`

Purpose:

- daily quiz persistence

Fields:

- `user_id`
- `quiz_day`
- `question_key`
- `prompt`
- `correct`
- `xp_earned`
- `response_ms`

Constraint:

- unique `(user_id, quiz_day, question_key)`

### 9.3 Derived Analytics

Derived on frontend:

- Algorithm DNA scores
- favorite algorithm
- common error type
- success rate
- heatmap
- weekly activity

## 10. Use Cases

### 10.1 Student Runs an Algorithm

1. user opens playground
2. writes or loads Python code
3. frontend sends `/analyze`
4. backend returns trace and algorithm label
5. frontend visualizes steps and audio
6. if no error, frontend requests `/complexity`
7. frontend saves session via `/session/save`
8. profile XP and achievements update

### 10.2 Student Hits an Error

1. trace returns `error`
2. playground shows error line
3. frontend sends `/mentor` in reactive mode
4. mentor response appears in chat
5. session is still stored for history and analytics

### 10.3 Student Uses Curriculum

1. `LearnPage` loads tasks
2. unlock state is derived from `task_progress`
3. user opens unlocked task
4. task starter code is preloaded into playground
5. on completion, next task is unlocked

### 10.4 Student Reviews Profile

1. frontend loads recent sessions
2. computes DNA metrics from last 20 sessions
3. renders radar chart, heatmap, stats, achievements, history

### 10.5 Student Uses Daily Ritual

1. user opens `Learn`
2. sees pet and daily quiz widgets
3. feeds pet once per day
4. starts 3-question quiz sprint
5. receives XP and pet progress
6. transitions into curriculum or playground

### 10.6 Demo Showcase

1. operator seeds demo users via backend script
2. frontend can expose `Demo Account` button if env vars are set
3. demo account opens with pre-populated sessions, achievements, DNA, pet, and quiz history

## 11. Gamification Model

### 11.1 XP

Sources:

- successful code runs
- failed runs
- task completion
- no-hint bonus
- fast-solve bonus
- achievements
- daily quiz attempts

### 11.2 Leveling

Level bands:

- 1: `0-199`
- 2: `200-499`
- 3: `500-999`
- 4: `1000-1999`
- 5: `2000+`

### 11.3 Streak

Updated on session save:

- same day -> unchanged
- yesterday -> increment
- older than yesterday -> reset to `1`

### 11.4 Achievement Evaluation

Evaluated in backend against:

- session count
- first error
- streak level
- task completion volume
- mentor usage
- attempts
- clean bubble sort run

## 12. Design Decisions

### 12.1 Why Supabase for Both Auth and Product State

- low operational overhead
- unified auth + postgres + JS client
- fast product iteration
- good fit for MVP and early-stage product

### 12.2 Why Frontend Computes Some Analytics

Examples:

- DNA radar metrics
- heatmap
- favorite algorithm

Reason:

- avoids unnecessary backend endpoints
- keeps computation close to UI
- metrics are not security-critical

### 12.3 Why Session Saving Stays in Backend

Reason:

- XP, streak, and achievement updates are trust-sensitive
- service-role access should not live in the browser
- one backend transaction point keeps business rules consistent

### 12.4 Why Daily Quiz is Frontend-Driven

Reason:

- small deterministic quiz bank
- low risk logic
- no need for an extra backend service for question generation

## 13. Known Constraints

1. Sandbox is thread-based, not process-isolated.
2. Trace semantics are heuristic, not full AST instrumentation.
3. Visualizer is optimized for array-centric algorithms only.
4. Gemini SDK is deprecated and should later be migrated.
5. Backend imports are flat and require `backend/` as runtime working directory.
6. Complexity fitting is empirical and intended for educational approximation, not formal proof.

## 14. Operational Files

Important project files:

- `backend/main.py`
- `backend/tracer.py`
- `backend/sandbox.py`
- `backend/classifier.py`
- `backend/mentor.py`
- `backend/seed_demo_data.py`
- `frontend/src/App.jsx`
- `frontend/src/pages/LearnPage.jsx`
- `frontend/src/pages/PlaygroundPage.jsx`
- `frontend/src/pages/ProfilePage.jsx`
- `frontend/src/pages/MentorPage.jsx`
- `frontend/src/hooks/useTracer.js`
- `frontend/src/hooks/useDNA.js`
- `frontend/src/hooks/usePet.js`
- `frontend/src/hooks/useDailyQuiz.js`
- `supabase/pet_quiz_schema.sql`
- `render.yaml`
- `frontend/vercel.json`

## 15. Summary

AlgoRythm is a multi-page learning platform with:

- a Python tracing backend
- heuristic event extraction on top of `sys.settrace`
- AST-based algorithm classification
- complexity estimation
- curriculum progression
- AI mentorship
- profile analytics
- gamification
- retention features built around pet care and daily quiz loops

The architecture is intentionally pragmatic:

- backend handles trust-sensitive and execution-sensitive logic
- frontend handles interaction-heavy and analytics-heavy logic
- Supabase provides persistence and identity
- the visualization model stays tightly scoped to array algorithms for clarity and reliability

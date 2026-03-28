# Product Brief - Orbit Planner

## A - Problem Statement

Students at bilingual universities often receive commitments in messy, informal language: a WeChat reminder from a supervisor, an English email about class, a quick note to buy supplies, or a half-remembered task typed on the go. Turning those requests into a usable plan usually means manually filling calendar forms, separately tracking to-dos, and retyping time, location, and priority details across multiple tools. When that overhead is skipped, meetings are missed, deadlines stay buried in chat history, and academic work competes with personal errands in one unstructured mental queue.

## B - Solution

Orbit Planner is an AI-first planner that converts natural-language requests into structured events and to-dos, then lets the user review, edit, search, and sync them in one place.

Its core product flow has three parts. First, the user types one sentence or a batch of schedule lines in Chinese or English, such as "meet advisor tomorrow from 3:00 PM to 4:30 PM; submit the proposal on Friday; buy printer paper". The system splits multiple schedules when needed, extracts title, time, location, priority, and item type, and opens a confirmation step before anything is saved. Second, confirmed items appear in a unified workspace with a calendar for events, a filtered to-do rail for tasks, and an editor that can update details or even convert a to-do into an event. Third, users can search past plans with keyword or AI-assisted semantic retrieval, review activity history with undo, and export or subscribe to their calendar through ICS/webcal.

This directly addresses the original problem by removing form-heavy scheduling work, reducing context switching between calendar and task apps, and making previously buried commitments retrievable after they are created.

## C - Target Users

**Primary user:**

Undergraduate and postgraduate students at bilingual universities, especially students who juggle classes, advisor meetings, assignments, club work, and personal errands across both Chinese and English inputs, and who create or adjust plans multiple times per day.

**Usage scenario:**

After checking WeChat and email in the morning, a student pastes a mixed schedule request into Orbit Planner, such as "meet advisor tomorrow from 3:00 PM to 4:30 PM in Trent Building; submit the project proposal on Friday; buy printer paper". The app splits the sentence into one event and two tasks, asks for confirmation if timing is ambiguous, saves them into the planner, and later lets the same student search "what did I do last week with my advisor" or export the week into a calendar app.

## D - Core Value Proposition

**One-sentence value proposition:**

For bilingual university students managing academic and personal commitments, Orbit Planner turns natural-language planning requests into an editable calendar-and-task workspace, so they can capture and act on commitments in seconds instead of manually entering forms across multiple tools, unlike traditional calendars, standalone to-do apps, or generic chatbots that do not maintain structured schedule state.

**Brief explanation (2-4 sentences):**

The product is designed for the real input students already have: mixed Chinese-English phrases, informal time expressions, and batches of unrelated tasks written in one burst. Instead of forcing the user to choose between "calendar app" and "task app," Orbit Planner keeps both views connected and adds history, search, and export on top. The confirmation-first flow also makes the AI useful without forcing blind trust.

## E - AI & Technical Approach

**AI / model type(s) used:**

- OpenAI-compatible LLMs through MiniMax models for schedule parsing, multi-item splitting, search-intent extraction, and result reranking
- Deterministic temporal parsing and normalization logic for dates, durations, locations, and event/todo coercion
- Next.js App Router + Bun runtime + Supabase backend for API routes, persistence, and calendar/history features

**Role of AI in the product:**

The AI layer interprets bilingual natural-language planning requests, including colloquial Chinese time phrases, mixed-language titles, and summary-style search queries. It helps split one input into multiple schedules, infer structured fields, understand semantic search intent, and rerank results when keyword matching alone is not enough. Around that AI layer, deterministic code handles fallback parsing, item payload normalization, history logging, undo behavior, and calendar export so the planner still behaves predictably when AI output is incomplete or unavailable.

**Why AI is the right approach here:**

A simpler rule-based system can handle explicit formats, but it struggles with the kinds of inputs this product targets: mixed Chinese-English phrasing, vague but common campus expressions, multi-schedule messages, and queries like "what did I do last week with my advisor?" Orbit Planner therefore uses a hybrid approach: AI handles language variability and semantic intent, while deterministic rules enforce reliable structure and safe fallbacks. This is also backed by automated Bun tests that cover parsing, provider fallback, search behavior, editor timing, and item payload normalization, which helps keep the AI-driven experience stable enough for real use.

## F - Key Assumptions

**Assumption 1:**

We assume that students are willing to enter plans in free text instead of filling traditional calendar forms, because the main value of Orbit Planner comes from replacing manual scheduling friction. This has not been validated by user interviews or usage analytics yet.

**Assumption 2:**

We assume that bilingual Chinese-English parsing accuracy is high enough for everyday campus planning requests, because the current implementation already handles common time ranges, colloquial durations, batch splitting, and ambiguity prompts. This has been partially validated by code-level tests, but not yet by a broad real-user dataset.

**Assumption 3:**

We assume that a lightweight, hackathon-stage workflow without full user accounts or two-way calendar sync is still useful, because fast capture, review, search, and one-way export may already solve the most immediate planning pain. This has not been validated with users who expect private workspaces, collaboration, or full synchronization.

## G - Differentiation

**Current alternatives or common approaches:**

Google Calendar and Apple Calendar are strong for structured event entry, but they are slow when the input starts as a messy sentence or includes both tasks and events. Standalone to-do apps capture tasks but disconnect them from calendar context. Generic AI chat assistants can interpret language, but they usually do not persist, edit, search, undo, and export schedule state in one product flow.

**What makes our approach different:**

Orbit Planner combines bilingual natural-language capture, a confirmation-first review step, unified calendar and to-do management, semantic search across saved items, history undo, and ICS/webcal export in one lightweight planner. The key trade-off is deliberate: we optimize for fast intake of messy real student input, not for heavyweight enterprise workflow depth.

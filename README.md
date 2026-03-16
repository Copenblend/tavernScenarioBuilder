# Tavern Scenario Builder

AI-powered wizard for creating complete roleplay setups in SillyTavern — characters, personas, worlds, lorebooks, and opening messages — all from a single guided workflow.

## Installation

Install via the SillyTavern extension installer:

```
https://github.com/Copenblend/tavernScenarioBuilder
```

## How to Update

In SillyTavern:

1. Open the extensions menu.
2. Click `Manage Extensions`.
3. Scroll down to `Tavern Scenario Builder`.
4. Click the update arrow.

## How to Use

Click the wizard hat icon in the sidebar (next to the group chats button) to open the builder.

The builder opens as a full-screen overlay with a **5-step guided wizard**. Each step builds on the previous one — the AI uses everything you've already created as context for the next step.

Complete all five steps, then click **Create in SillyTavern** to generate your character card, world info files, and persona in one click.

## Layout

The overlay has two panels:

- **Workspace (left)** — The wizard steps. This is where you write prompts, generate content, and edit results.
- **Entries Panel (right)** — A live summary of everything you've accepted so far. Each completed step appears as a collapsible accordion. Click the edit button on any entry to jump back to that step.

The divider between panels is **draggable**. Drag it left or right to resize (25%–75% range). Your preferred ratio is saved automatically.

### Header Controls

- **Settings (gear icon)** — Opens the settings panel for system prompt injection and other options.
- **Close (X icon)** — Closes the overlay. Your session is saved automatically.

## Wizard Steps

### Step 1: Scenario

Describe the story or scenario you want to roleplay.

**What you provide:**
- A text description of the scenario (e.g., *"A dark fantasy world where an exiled knight seeks redemption..."*).

**What the AI generates:**
- A structured scenario document with sections for Setting, Time Period, Premise, Key Themes, Tone & Atmosphere, and Story Hooks.

**Customization options:**
- **Story Hooks** — Control how many story hooks are generated (0–20, default 4).
- **Max Tokens** — Limit the response length (0 = unlimited).
- **Output Sections** — Toggle individual sections on/off with checkboxes (Setting, Time Period, Premise, Key Themes, Tone & Atmosphere, Story Hooks).

**After generation:**
- View the result as formatted markdown.
- Click **Edit** to modify the raw text, then **Save** to re-render.
- Click **Regenerate** to get a completely different version.
- Click **Accept** to lock it in and move to the next step.

---

### Step 2: Persona

Create your player character — the person *you* will be roleplaying as.

**What you provide:**
- A name for your persona.
- A text description (e.g., *"A disgraced noble seeking to reclaim their family honor..."*).
- An optional avatar image (click **Upload Avatar** to browse for an image file).

**What the AI generates:**
- A prose persona description, written with your scenario as context.

**Customization options:**
- **Max Tokens** — Limit the response length.

**After generation:**
- Same Edit / Regenerate / Accept flow as Scenario.

---

### Step 3: Character

Build the AI character — the bot you'll be talking to.

**What you provide:**
- A text description of the character (e.g., *"A mysterious elven sorceress with a dark past..."*).
- An optional avatar image.

**What the AI generates:**
- A complete character profile broken into individually editable fields.

**Character fields (organized by section):**

| Section | Fields |
|---------|--------|
| **Basic** | Name, Age |
| **Physical Description** | Hair, Eyes, Height, Body, Face, Distinguishing Features |
| **Personality** | Traits, Habits, Behavior |
| **Preferences** | Likes, Dislikes |
| **Sexuality** | Orientation, Kinks, Likes, Dislikes |
| **Speaking** | Style, Quirks |
| **Advanced Definitions** | Personality Summary, Scenario, Character Note |

**Customization options:**
- **Detail Level** — Controls how verbose the AI's output is:
  - *Minimal* (~1000 tokens)
  - *Balanced* (~2000 tokens, default)
  - *Verbose* (~5000 tokens)
  - *Connection Profile Limit*
- **Per-field regeneration** — Each field has its own regenerate button. Regenerate just one field while keeping everything else intact.
- **Regenerate All** — Re-generate every field at once.

#### Speech Examples

Below the character fields, you can manage speech examples:

- **Generate Speech Example** — AI writes a new in-character dialogue sample.
- **Add Speech Example** — Add a blank example to write yourself.
- **Remove** — Delete individual examples.

Speech examples are automatically wrapped with `<START>` tags when the final character card is created.

#### Character Lorebook

Below speech examples, you can build a lorebook for the character:

- **Generate Lorebooks** — AI creates a batch of lorebook entries based on the character profile.
- **Add Entry** — Add a blank lorebook entry to write yourself.
- Each entry has: **Title**, **Keywords** (comma-separated), **Content**, and a **User Prompt** field to guide per-entry generation.
- Each entry has its own **Regenerate** and **Remove** buttons.

Click **Accept Character** when you're satisfied with all fields, examples, and lorebook entries.

---

### Step 4: Location

Define the world and locations where the story takes place.

**What you provide:**
- A text description of the location (e.g., *"Earth 2047, Old Ohio, My House"* or *"A sprawling cyberpunk megacity"*).

**What the AI generates:**
- Multiple world info entries, each with a Title, Keywords, and Content. These become SillyTavern World Info entries that activate when matching keywords appear in conversation.

**Customization options:**
- Same per-entry editing as lorebook: Title, Keywords, Content, User Prompt for guided generation.
- **Add Entry** — Add a blank location entry.
- Per-entry **Regenerate** and **Remove** buttons.

Click **Accept Location** to lock in and move to the final step.

---

### Step 5: First Message

Generate the character's opening message that starts the roleplay.

**What you provide:**
- Optionally describe the scene you want (e.g., *"The character is waiting at a rain-soaked bus stop at midnight, lost in thought..."*). Leave blank to let the AI decide based on all established context.

**What the AI generates:**
- A 2–4 paragraph opening message in third person, present tense, with a mix of `*actions*`, `*thoughts*`, and `"dialogue"`. The first message establishes the formatting pattern for the entire roleplay.

**After generation:**
- Same Edit / Regenerate / Accept flow.

---

## Creating Artifacts in SillyTavern

Once all five steps are accepted, a **Create in SillyTavern** button appears in the entries panel.

Clicking it creates the following artifacts:

| Artifact | Description |
|----------|-------------|
| **Location World Info** | A World Info file named `"{Character Name} Locations"` containing all location entries. Standalone — not linked to the character. |
| **Character Lorebook** | A World Info file named `"{Character Name} Lorebook"` containing all lorebook entries. **Linked** to the character card as its Primary Lorebook via the `world` field. |
| **Character Card** | A full character card with all fields populated. Includes description, personality, scenario, first message, speech examples, character note, and linked lorebook. Avatar uploaded if provided. |
| **Persona** | A SillyTavern persona with the name, description, and avatar you provided. |

### Name Macro Replacement

During creation, the builder automatically replaces names with SillyTavern macros throughout all text fields:

- All occurrences of the **character's name** → `{{char}}`
- All occurrences of the **persona's name** → `{{user}}`

This applies to: character description, personality, scenario, first message, speech examples, character note, lorebook content, and location content.

### After Creation

SillyTavern's character list, world info list, and persona list are automatically refreshed so your new content appears immediately. You're ready to start chatting.

---

## Session Persistence

Your progress is **automatically saved** every time you accept a step. If you close SillyTavern or the overlay, your work is preserved.

When you reopen the builder with a saved session:

- A **"Resume Session?"** dialog appears.
- **Resume** — Restores all your completed steps, entries, and tab state. Navigates to the step where you left off.
- **Start New** — Clears the saved session and starts fresh.

---

## Settings

Click the **gear icon** in the header to open the settings panel.

| Setting | Description |
|---------|-------------|
| **System Prompt Injection** | Text appended as a final system message in every AI generation call. Useful for model-specific instructions (e.g., `/nothink\n` for GLM-4 to suppress chain-of-thought). |

Additional per-step settings appear inline within each step's UI (Story Hooks, Max Tokens, Detail Level, Section Toggles).

---

## Context Accumulation

Each wizard step feeds into the next. The AI receives all previously accepted content as context:

| Step Being Generated | Context Included |
|---------------------|------------------|
| Scenario | *(none)* |
| Persona | Scenario |
| Character | Scenario + Persona |
| Location | Scenario + Persona + Character |
| First Message | Scenario + Persona + Character + Location |

This means later steps are deeply informed by earlier decisions, producing a coherent and consistent roleplay setup.

---

## Important Note: AI Model Compatibility

This extension has only been tested with **GLM-4** (specifically GLM-4.6). It should work with other models connected through SillyTavern, but prompt formatting, JSON parsing reliability, and output quality may vary. If you experience issues with a different model:

- Try adjusting the **System Prompt Injection** in settings (e.g., adding `/nothink\n` for models that output chain-of-thought reasoning).
- Try adjusting **Max Tokens** if outputs are being truncated or are too verbose.
- Try **Regenerate** if the AI produces malformed output — some models need a second attempt for structured JSON responses (character fields, lorebook entries, location entries).
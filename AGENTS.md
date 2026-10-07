<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Contributor & Development Rules

These rules apply to any AI assistant or agent working within this repository across all contributor machines:

### 1. Git Author & Contribution Credit (CRITICAL)
- Whenever creating or amending commits on a contributor's machine, **always ensure the Author name and email match that contributor's local Git configuration** (`git config user.name` and `git config user.email`).
- **Never hardcode another member's name or email** as the author or committer.
- When running `git commit --amend`, **always include `--reset-author`** (e.g., `git commit --amend --reset-author --no-edit`) so Git updates the commit author to the active contributor, ensuring they receive proper credit on GitHub's Contributors list.

### 2. Feature Implementation from Reference Files
- When a user shares a reference HTML file, screenshot, or SVG for a page, **implement only that specific page/feature**. Do not overdo or modify unrelated pages or components.
- Adhere strictly to the design, layout, styling, and interactive elements provided in the reference.
- Follow any specific user instructions provided with or without reference files.

### 3. Localhost Verification Before Commit
- Verify all changes on the local development server (`http://localhost:3000`) before finalizing. Ensure routes compile cleanly with zero errors.
- Do not push to remote repositories unless explicitly instructed by the user.

### 4. Clean Commit Messages
- Write concise, descriptive commit messages summarizing the feature implemented (e.g., `feat: implement <Page Name>`).
- Do not include meta instructions or phrases like "matching figma design" in commit messages.


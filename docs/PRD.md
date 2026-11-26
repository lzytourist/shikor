# Shikor (শিকড়) — Product Requirements Document (PRD)

**Product Name:** Shikor (`শিকড়` — *"Roots"*)  
**Document Status:** v1.0  
**Last Updated:** 2026-11-26  

---

## 1. Executive Summary & Vision

Most genealogy tools fall into two extremes: bloated, Western-centric archival suites with dated interfaces, or simplistic tree-drawing toys (`d3.hierarchy` single-parent trees) that break as soon as real-world family structures appear—such as childless marriages, remarriages, cousin marriages, adoptive/step-parents, unknown historical ancestor names, missing birth dates, and extended multi-generational clans.

**Vision:** Build a modern, collaborative, visual-first family tree and living family directory platform where anyone can map their heritage, preserve stories and timelines, calculate cultural kinship relationships (including Bengali kinship terms alongside English), locate relatives across the globe, and safely share or co-edit trees with their extended family.

---

## 2. Problem Statement (Insights from v1 Prototype)

Analysis of the v1 Django + `d3.hierarchy` database (`docs/db.sql`, 150 members across 7 generations) surfaced critical real-world pain points:

1. **Spouses Cannot Exist Without Children:** Linking relatives solely via `father_id` and `mother_id` prevents adding newlyweds, childless couples, or tracking multiple marriages (`married`, `divorced`, `widowed`).
2. **Real Families Are Graphs (DAGs), Not Strict Trees:** Cousin marriages (e.g., two descendants of the same ancestor marrying) and in-law ancestor branches break strict single-parent hierarchy visualizers (`d3.hierarchy`).
3. **Historical Dates Are Rarely Exact:** Out of 150 real family entries, only 3 had exact `YYYY-MM-DD` birth dates, and `death_date IS NULL` falsely implied 19th-century ancestors were still alive. Users need an explicit `Living / Deceased` toggle and fuzzy dates (`~1920`, `1955`, `Unknown`).
4. **Incomplete Ancestor Names & Nicknames:** Families frequently remember birth order without names (e.g., *"2nd Son"*, *"1st Daughter"*) and refer to relatives by nicknames (*daknam*, e.g., *"Sunny"*) or native script (`বাংলা`).
5. **Single-User Silo:** Tying records to a single user prevents a person from maintaining separate trees (e.g., paternal vs. maternal) and stops cousins/uncles from collaborating on their own branches.
6. **Friction in Sharing:** Relatives in a family WhatsApp group want instant read-only access via a link + passcode without mandatory account creation.

---

## 3. Target Personas

| Persona | Goals & Needs |
| :--- | :--- |
| **1. The Family Historian (Tree Owner)** | Digitizes 5–10+ generations from elders' memories; needs fast on-canvas node creation, support for fuzzy dates/unknown names, and control over who can edit vs. view. |
| **2. The Branch Collaborator (Editor)** | Invited cousin, aunt, or sibling who fills in accurate birthdates, blood groups, photos, cities, and children for their own nuclear/extended branch. |
| **3. The Curious Relative (Viewer / Link Guest)** | Opens a passcode-protected link from a family chat on mobile or desktop; wants to find themselves, see how they're related to distant cousins (*"Oh, he's my Fupato Bhai!"*), check blood groups, or read elders' life stories. |

---

## 4. User Stories & Functional Requirements

### 4.1 Multi-Tree Workspaces, Collaboration & Sharing
- **FR-1.1 Multi-Tree Ownership:** Authenticated users can create and switch between multiple independent family trees.
- **FR-1.2 Role-Based Access Control (RBAC):** Tree Owners can invite registered users by email with roles:
  - `Owner`: Full control over tree settings, share links, collaborators, and all data.
  - `Editor`: Can add/edit/delete persons, partnerships, parent-child links, avatars, and timeline events.
  - `Viewer`: Read-only access to the full tree workspace.
- **FR-1.3 "This Is Me" Profile Claiming:** Any `Owner`, `Editor`, or `Viewer` member of a tree can link their user account to their corresponding `Person` node in that tree.
- **FR-1.4 Passcode-Protected Share Links:** Tree Owners can generate one or more revocable share links (`/share/[token]`) with a custom passcode and optional expiration date. Guests who enter the passcode unlock full read-only access to the tree without creating an account.

### 4.2 Core Genealogy Data Model
- **FR-2.1 Rich Person Profiles:**
  - **Names:** Display Name, Full Legal Name, Nickname (*Daknam*), Native Script Name (e.g., `বাংলা`), OR `Unknown Name` flag with a clean placeholder label (e.g., *"2nd Son"*).
  - **Vitals:** Gender (`Male`, `Female`, `Other`, `Unknown`), explicit `Living / Deceased` status, Sibling Sort Order, and Twin indicator.
  - **Flexible Dates:** Birth and Death dates supporting `Exact Date (YYYY-MM-DD)`, `Year & Month`, `Year Only (YYYY)`, `Approximate (~YYYY)`, or `Unknown`.
  - **Directory & Bio Attributes:** Profile Avatar photo, Blood Group (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`), Occupation/Profession, Education, Birthplace, Current City & Country, Contact Phone/Email, and Markdown Biography/Story.
- **FR-2.2 Partnerships / Unions:**
  - Connect any two persons in a `Partnership` regardless of whether they have children.
  - Track relationship status (`Married`, `Divorced`, `Widowed`, `Separated`, `Engaged`), marriage order (for remarriages), and flexible start/end dates.
- **FR-2.3 Parent-Child Lineage Types:**
  - Support `Biological`, `Adoptive`, `Step`, and `Foster` parent-child links simultaneously (e.g., recording both biological and adoptive parents cleanly) with cycle validation (no person can be their own ancestor).
- **FR-2.4 Life-Events Timeline:**
  - Each person profile includes a chronological timeline of milestones (`Birth`, `Marriage`, `Education`, `Career`, `Migration`, `Achievement`, `Death`, `Burial/Grave Location`, `Custom`).

### 4.3 Interactive Visualization & Workspace Views
- **FR-3.1 Switchable Workspace:** Unified top navigation switching seamlessly between **Graph View**, **Family Directory**, **Family Map**, and **Kinship Calculator**, plus a global `Ctrl+K` / `Cmd+K` search palette.
- **FR-3.2 DAG Family Graph Canvas:**
  - Smooth pan, zoom, minimap, fit-to-screen, and mobile touch gestures.
  - **Union Nodes:** Spouses connect into a dedicated marriage/union node from which children branch symmetrically.
  - **DAG Support:** Renders cousin marriages and in-law ancestor trees cleanly without duplicating person nodes.
  - **Decluttering Controls:** Collapsible/expandable subtrees and **Hourglass Focus Mode** (pick any focus person to display only their ancestors upward and descendants downward).
  - **On-Canvas Quick Actions:** Selected person cards expose `+ Parent`, `+ Spouse`, `+ Sibling`, and `+ Child` actions directly on the canvas (`Owner`/`Editor` only).
- **FR-3.3 Slide-Over Person Inspector:**
  - Clicking any node opens a non-destructive right-hand drawer with **Overview**, **Story/Bio**, and **Timeline** tabs, plus quick inline editing.
- **FR-3.4 Searchable Family Directory:**
  - High-density table view filterable by **Blood Group** (e.g., emergency donor lookup), **Living/Deceased**, **Gender**, **City/Country**, and text search across names/nicknames/occupations.
- **FR-3.5 Diaspora Map View:**
  - Interactive OpenStreetMap view plotting family members by current city/country with clustered markers; clicking a cluster lists relatives living in that city and links back to their profiles.

### 4.4 Cultural Kinship Calculator (English + Bengali · বাংলা)
- **FR-4.1 Automatic Relative Badges:** When a logged-in member has claimed *"This is me"*, viewing any relative displays how that person is related to them.
- **FR-4.2 Any-Two-People Pathfinder:** Users (and passcode link guests) can pick any `Person A` and `Person B` to compute:
  - **English relationship label** (e.g., *Paternal Uncle*, *Maternal First Cousin*, *Sister-in-law*).
  - **Bengali kinship label + script** distinguishing paternal/maternal and in-law ties (e.g., *Chacha · চাচা*, *Jetha · জেঠা*, *Fupu · ফুপু*, *Mama · মামা*, *Khala · খালা*, *Chachato Bhai · চাচাতো ভাই*, *Fupato Bon · ফুপাতো বোন*, *Bhabi · ভাবী*, *Dulabhai · দুলাভাই*, *Bhatija · ভাতিজা*, *Bhagina · ভাগিনা*).
  - **Visual Graph Highlight:** Highlights every intermediate relative and marriage along the shortest connection path(s).

### 4.5 Legacy Data Migration (v1 Seed)
- **FR-5.1 `docs/db.sql` Smart Importer:** Automated seed pipeline migrating all 150 legacy family records:
  - Extracts parenthetical nicknames (`"Ayesha (Sunny)"` → Name: *Ayesha*, Nickname: *Sunny*).
  - Converts `"N/A"` entries into clean `is_name_unknown` placeholders (*"2nd Son"*, *"1st Daughter"*).
  - Infers explicit `Partnership` records from shared `(father_id, mother_id)` pairs (including cousin marriages).
  - Sanitizes legacy credentials (creates fresh local seed credentials without reusing legacy password hashes or tokens).

---

## 5. Non-Functional Requirements (NFRs)

1. **Performance:** Smooth 60fps pan/zoom on trees up to 500+ members using virtualized/memoized React Flow nodes and fast server-side initial graph payloads (<300ms DB query for 500-node tree).
2. **Security & Privacy:**
   - All authorization enforced in a `server-only` Data Access Layer (never trusting client state).
   - Passcode share links store bcrypt/argon2-hashed passcodes, rate-limit unlock attempts, and issue `HTTP-only`, `SameSite=Lax` signed cookies scoped strictly to that `tree_id`.
3. **Mobile Responsiveness:** Touch-friendly canvas pan/zoom, bottom-sheet profile drawer on mobile viewports, and responsive directory cards—critical for relatives opening links from WhatsApp on phones.
4. **Unicode & Typography:** First-class UTF-8 and font rendering for both Latin and Bengali (`Noto Sans Bengali` / `Hind Siliguri`) scripts.

---

## 6. Out of Scope for v1 (Future Roadmap — v1.1+)

- GEDCOM (`.ged`) file import/export and bulk CSV import.
- Printable high-resolution PDF/SVG wall-poster generator.
- Multi-person photo tagging galleries and recorded audio/voice-note memories.
- Suggestion/PR-style edit approval queues for untrusted contributors.
- Full bilingual (`en` / `bn`) UI localization (v1 uses an English UI with rich বাংলা names and kinship badges).

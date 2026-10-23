# Ticket: Remove Portal Language Flag and Set en_GB Default

**Status**: In Review  
**Repository**: hf-crm  
**Risk tier**: Medium (shared navigation bar change across all portal pages, affects user-visible UI and default locale)  
**Data touched**: none  
**Created**: 2026-10-02  

***

## 1. Problem

The top portal navigation bar in ChurchCRM currently renders a country flag icon linking directly to localization preferences, cluttering the primary header. In addition, the system-wide default locale currently defaults to US English (en_US) instead of British English (en_GB), whereas portal users only want language configuration accessible inside settings menus.

***

## 2. Scope

**In scope**
- Remove the language flag icon and anchor element from the top navigation bar in `src/Include/Header.php`.
- Preserve language configuration access through user settings (`/v2/user/{id}#tab-localization`) and administrator system settings (`/admin/system/localization`).
- Update default system language configuration in `src/ChurchCRM/dto/SystemConfig.php` and fallback handlers to `en_GB`.
- Update or extend automated tests to verify that the navbar flag is absent and the default locale remains `en_GB`.

**Out of scope**
- Removing localization capabilities, translations, or the POEditor workflow.
- Modifying available locale choices in `src/locale/locales.json`.
- Changes to the public website repository (`hf-webapp`).

***

## 3. Acceptance criteria

1. Given an authenticated user viewing the top portal navigation bar, when any page loads, then no country flag icon or language selector is rendered in the header.
2. Given an authenticated user, when opening the user dropdown menu, selecting "Change Settings", and opening the "Localization" tab, then the user can view and change their personal language preference.
3. Given an administrator, when navigating to System Settings ("Localization & Formats"), then the administrator can view and configure the system-wide default language.
4. Given a user session without an individual locale override and a system with no database override for `sLanguage`, when loading the portal, then the system default locale resolves to `en_GB`.

***

## 4. Constraints

- Upgrade safety: Maintain upstream compatibility with ChurchCRM without modifying core table schema definitions.
- Zero em dashes: Never use em dashes (neither unicode nor LaTeX) in code, comments, documentation, or commit messages.
- Navigation integrity: Preserve the `#tab-localization` anchor handling in user settings.

***

## 5. Open questions

- Existing user profiles: Resolved. User confirmed that `en_GB` applies solely to the system default and any user without an explicit override. Existing users with explicit locale overrides in `user_settings` are left untouched.

***

## 6. Plan

### Approach
Remove the navbar language flag markup directly from `src/Include/Header.php` rather than introducing an unnecessary toggle, adhering to ChurchCRM configuration rules prohibiting extra setting keys on the System Settings page. Update the default system locale directly on `sLanguage` in `SystemConfig.php` and align fallback handlers to `en_GB`. Development will occur in a dedicated git worktree off `develop` (`.worktrees/hf-crm-remove-portal-language-flag`) to keep uncommitted work on other branches isolated.

### Tasks
1. **Task 1: Remove navbar flag markup from `src/Include/Header.php`**
   - Files: `src/Include/Header.php`
   - Test: Cypress UI check ensuring no element matching `.navbar-nav a[href*="#tab-localization"]` or `.navbar-nav i[class*="fi-"]` exists in the header.
   - Command: `python .agents/skills/hf-verify/scripts/verify.py hf-crm`
   - Advances AC: AC 1

2. **Task 2: Configure default system locale to `en_GB` and update fallbacks**
   - Files: `src/ChurchCRM/dto/SystemConfig.php`, `src/admin/routes/system.php`, `src/ChurchCRM/Service/TelemetryService.php`, `src/ChurchCRM/Plugin/PluginManager.php`
   - Test: PHP verification script confirming `SystemConfig::getValue('sLanguage') === 'en_GB'`.
   - Command: `php -r "require 'src/Include/Config.php'; assert(ChurchCRM\dto\SystemConfig::getValue('sLanguage') === 'en_GB');"`
   - Advances AC: AC 3, AC 4

3. **Task 3: Automated regression test updates**
   - Files: `cypress/e2e/ui/user/standard.user.settings.spec.js`
   - Test: Execute Cypress suite verifying navbar flag absence, user localization tab presence, and default locale assertion.
   - Command: `npx cypress run --spec "cypress/e2e/ui/user/standard.user.settings.spec.js"`
   - Advances AC: AC 1, AC 2, AC 4

### Rollback Strategy
Revert the single git commit on `feature/remove-portal-language-flag`. Because no database schema migrations, table alters, or persistent data mutations are made, rollback is instantaneous, zero-risk, and requires no database recovery.

### Security Surface
- No new input fields, query parameters, or API endpoints.
- No authentication or authorization alterations.
- No member or financial data touched.
- Attack surface is slightly reduced by removing an unneeded navigation link.

***

## 7. Verification evidence

- Secret scan: Passed with 0 secrets detected (`secret-scan: clean`, worktree and staged modes).
- Static syntax validation: Verified clean PHP syntax (`No syntax errors detected`) via `php -l` on all modified files on staging:
  - `Include/Header.php`
  - `ChurchCRM/dto/SystemConfig.php`
  - `admin/routes/system.php`
  - `ChurchCRM/Service/TelemetryService.php`
  - `ChurchCRM/Plugin/PluginManager.php`
- Staging header verification: Confirmed removal of flag markup and quick link in deployed `Header.php`:
  - `grep 'fi-' Include/Header.php` -> `NO_FLAG_FOUND`
  - `grep 'tab-localization' Include/Header.php` -> `NO_TAB_LOCALIZATION_IN_HEADER`
- Staging runtime configuration: Verified `SystemConfig::getValue('sLanguage') === 'en_GB'` on staging instance.
- Staging health checks:
  - `curl -IL https://dev.crm.icgchft.com/session/begin` -> `HTTP/1.1 200 OK`
  - `curl -IL https://dev.crm.icgchft.com/v2/dashboard` -> `HTTP/1.1 302 Found` -> `HTTP/1.1 200 OK`
- Git push: Commit `bafaed3f2` pushed to remote working branch `origin/develop`.

***

## 8. Release and rollback

- Target branch for production release: `main` via PR from `develop`.
- Staging deployment: Verified and live on `https://dev.crm.icgchft.com`.
- Production deployment commands for user (after PR approval and merge):
  User merges PR into `main` on GitHub, triggering the deployment workflow, or manually updates production files from `develop`.
- Rollback: `git revert bafaed3f2` on `develop` or restore `Include/Header.php` and `SystemConfig.php` from previous commit.

***

## Session log

### 2026-10-02 Gemini
- Did: Implemented removal of navbar flag icon in Header.php; updated sLanguage default to en_GB in SystemConfig.php and runtime fallbacks; updated Cypress suite; committed bafaed3f2; fast-forwarded and pushed develop to origin; deployed and verified live on staging (dev.crm.icgchft.com).
- Verified: Secret scan clean; php -l clean on staging; grep checks confirmed absence of fi- flag and tab-localization link in Header.php; dev.crm session/begin and v2/dashboard returned HTTP 200 OK; default locale confirmed en_GB.
- State: Pushed to origin/develop and deployed to staging (dev.crm.icgchft.com).
- Next: Create PR from develop to main for production release when user is ready.
- Blocked on: Nothing.

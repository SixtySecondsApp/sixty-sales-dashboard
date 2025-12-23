# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Reorganized project documentation into `/docs/` structure
- Moved test scripts to `/tests/scripts/`
- Archived 448 historical documentation files
- Cleaned up 344 one-off SQL scripts from root
- Updated .gitignore with comprehensive patterns

## [2.1.5] - 2024-12

### Added
- Meeting Intelligence with AI-powered transcript analysis
- Smart Tasks with automated task generation
- Proposal confirmation modal workflow

### Changed
- Simplified pipeline to 4 stages (SQL → Opportunity → Verbal → Signed)
- Enhanced QuickAdd component with better duplicate detection

### Fixed
- React rendering issues in QuickAdd component
- Calendar event linking with correct owner_id

## [2.1.0] - 2024-11

### Added
- Google Calendar integration with manual sync
- JustCall integration for call recording
- Slack deal room channels

### Changed
- Improved admin security controls
- Enhanced revenue split management

### Fixed
- RLS policies for organization memberships
- Performance optimizations (64% memory reduction)

## [2.0.0] - 2024-10

### Added
- Complete CRM rebuild with React 18
- Real-time subscriptions with Supabase
- Meeting content management
- Email sync capabilities

### Changed
- Migrated from legacy system to new architecture
- New dark theme UI design
- Improved performance (80% fewer re-renders)

## [1.0.0] - 2024-08

### Added
- Initial release
- Basic deal management
- Contact tracking
- Activity logging

---

## Version Guidelines

- **Major** (X.0.0): Breaking changes, major features
- **Minor** (0.X.0): New features, enhancements
- **Patch** (0.0.X): Bug fixes, minor improvements

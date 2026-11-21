# Settings skeleton visual review

Read only. Reviewed settings-sheet-1.jpg and settings-sheet-2.jpg: users, tokens, notifications, dictionaries, synchronization configuration, About, and profile without a cached user, each in light and dark themes. Browser interaction/completion/overflow evidence is supplied by the parent rather than inferred from these images.

## Visible result

- All table/list/form/inline metadata skeletons are visible in both themes. Light skeletons use soft pale-green depth; dark skeletons keep a subdued green face and remain distinguishable from the surrounding panel.
- Users/tokens/dictionaries align their row skeletons with a table surface; notifications retain a row/list rhythm and avoid showing an unloaded read count. The skeletons have round ends and quiet highlights consistent with the existing jade material.
- About preserves the known logo/version/actions/facts while the description and public-account value wait inline. Those placeholders fit their slots and introduce no competing labels.
- The sidebar stays complete and usable across all waiting screens. Its width and separator are consistent with the rest of the settings layout, and it does not crowd the skeleton area. The large blank area below short skeleton lists is the retained work-surface height, not an enlarged sidebar or a skeleton taking excessive space.
- No clipping, horizontal squeeze, hard/sharp placeholders, or visually heavy glow is visible in these two sheets.

## Layout stability gaps to check

1. Profile without a cached user: the waiting branch starts directly with Personal Information and Security form cards. The loaded branch also renders an account overview row (avatar/name/role/logout) above these forms. A corresponding account-row placeholder is missing in the loading layout, so the forms will move downward when that row arrives. This is a structure difference confirmed by the current branch in SettingsView; the sheets do not contain the loaded counterpart for measuring its pixel displacement.
2. Sync configuration: the waiting layout goes directly into three rows of two form-field placeholders. The loaded form has a database-type choice row above those fields. A three-option placeholder row is missing, so the fields/footer can shift when configuration resolves. This structure difference is confirmed by DataSyncPanel; compare loading/loaded DOM geometry before claiming no layout shift.

Suggested contained fix: reserve those two missing blocks with Skeleton using the existing account/config grid classes. Keep known sidebar/header/copy and all material tokens unchanged. Other reviewed regions have no actionable visual issue.

Limitations: still images do not establish shimmer playback, reduced-motion behavior, loaded-state geometry, or the native updater restoration slot. Those rely on parent runtime tests or subsequent images.

## Contained repairs after review

- Unknown-profile loading now reserves the same account group before forms: 40px circle, name/role slots, and 40px action placeholder. Both Personal Information and Security groups reserve their existing footer slots. Name/metadata and field labels use the corresponding font/line-height tokens, so loading row height follows the loaded text line boxes.
- Sync loading now includes the two actual database options in RadioGroup's existing three-column tracks and responsive behavior. Its form uses columns=3 and the first host placeholder spans two tracks via the existing settings-field--wide class. The shared private SettingsFormSkeleton wideFields prop defaults empty, so other call sites retain their layout.
- Unknown profile restoration that finishes with user=null ends in an explicit retryable loading failure, with no Save/Password action. Retry uses the existing refreshUser read, and cached valid user data remains visible when refresh fails.

Scoped verification after repairs: SettingsView + DataSyncPanel, 34/34 tests passed; scoped ESLint 0 warnings; changed-file Prettier and git diff --check passed. New mock test covers pending → null-user failure → retry pending → valid user, including absence of unknown-profile save actions. Parent will measure and render loading/loaded geometry; no new visual pass is claimed from source alone.

## Final WebKit visual pass

Reviewed only webkit-settings-sheet.jpg after the contained repairs: users, dictionaries, sync configuration, and unknown-profile waiting states in light and dark themes (8 views).

- Profile's account row is now present, including round avatar, two text/role placeholders, and the right action placeholder. Personal Information and Security both show reserved footer slots. The three groups form a coherent stack without the earlier omitted regions.
- Sync configuration now shows two database-type option placeholders on the retained three-column tracks, a host field spanning two tracks, and the existing footer. The fields align with those tracks and retain the expected form spacing.
- Table skeletons, form skeletons, inline blocks, sidebar, and Dock remain visible and visually coherent in both themes. Pale and night jade faces use soft rounded ends/highlights; no clipping, crowding, hard rectangular artifacts, heavy glow, or new visual issue is visible.
- No residual actionable visual finding remains in this final reviewed sheet.

Runtime evidence supplied by parent: after fonts and finite animations complete, four profile/sync loading-to-loaded scenarios had zero field y/height and heading y differences; 30 WebKit pages completed loading with no horizontal overflow or page/console error. Those measurements are separate from this 8-view visual pass. Full-suite/build/native acceptance claims remain the parent's responsibility.

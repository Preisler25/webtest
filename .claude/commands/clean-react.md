# Clean React Code Review

Review the selected or recently changed React/TypeScript code and apply clean-code principles specific to this codebase. Focus only on the file(s) specified in $ARGUMENTS, or the currently open/modified file if none given.

## What to check and fix

### Component structure
- Each component does one thing. If it has more than ~150 lines of JSX logic, consider splitting — but only if the split has a meaningful name.
- Render branches (e.g. discriminated union stages like `if (stage.kind === 'library')`) should each return early rather than be nested in a single return.
- Avoid passing raw Firebase `User` when only a subset of fields is needed — derive a lean prop type.

### State
- Don't use separate `useState` for fields that always change together (e.g. `editSource`/`editTarget` on a word). Group them into a single object or derive them from a parent record.
- Loading and error state per async operation, not one global flag shared across unrelated actions.
- Derived values (filtered lists, computed labels) should be `useMemo` or plain variables inside render — not stored in state.

### Props
- All tab components follow the `TabProps` shape from `src/types.ts`. If a component doesn't need all fields, declare only what it uses in a local `type Props`.
- `onRefresh: () => Promise<void>` is the standard callback to re-run `loadDashboard` after a mutation. Use it consistently.

### Firestore access
- Keep all Firestore calls inside async event handlers or `useEffect`. No reads in render.
- `wordCount` on a wordset is maintained manually via `increment(±1)` — don't recalculate it from the subcollection.
- Use `writeBatch` when writing more than one document in a single logical operation.

### TypeScript
- Prefer discriminated unions over boolean flags for multi-step flows (see `Stage` type in `PracticeTab`).
- Avoid `as` casts except when mapping Firestore snapshots (`s.data() as Omit<Wordset, 'id'>`).
- All shared types live in `src/types.ts`. Don't re-declare types that already exist there.

### Naming and style
- Hungarian UI strings stay in the JSX. Don't extract them to constants unless reused in 3+ places.
- CSS class names follow the existing flat BEM-like convention (`.stat-card`, `.stat-card--coral`). Don't introduce inline styles for layout that belongs in the stylesheet.
- Async event handlers that are not `useCallback`-wrapped: use `void` to explicitly discard the promise (`void addWord()`).

## What NOT to do
- Don't add comments that describe what the code does — rename things instead.
- Don't add error boundaries, Suspense, or lazy loading unless explicitly requested.
- Don't introduce new dependencies (routing library, state manager, UI library) without discussion.
- Don't split a component just because it's long — split only when the extracted piece has independent meaning and reuse potential.

After reviewing, list each finding as a short bullet with file:line, then apply fixes if $ARGUMENTS includes `--fix`.

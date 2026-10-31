# @lp-labs/react-document-outline

A scoped table of contents for React 18.2 and 19. Explicit heading data works
without browser APIs; DOM extraction and active-section observation are optional.
React is the only peer and there are no runtime dependencies.

## Install and use

```sh
npm install @lp-labs/react-document-outline react
```

```tsx
import { useRef } from "react";
import { DocumentOutline } from "@lp-labs/react-document-outline";
import "@lp-labs/react-document-outline/style.css";

export function Article() {
  const article = useRef<HTMLElement>(null);
  return (
    <div>
      <DocumentOutline
        scopeRef={article}
        onActiveChange={(id) => console.log("Active:", id)}
        onNavigate={(heading) => console.log("Requested:", heading.id)}
      />
      <article ref={article}>
        <h1 id="introduction">Introduction</h1>
        <p>Start here.</p>
        <h2 id="details">Details</h2>
        <p>More information.</p>
      </article>
    </div>
  );
}
```

## Exports and types

`OutlineHeading` is `{ id: string; text: string; level: number }`. IDs must be
unique and nonempty, and levels must be integers 1-6. Invalid explicit headings
throw `RangeError`. Heading text is rendered as React text, not HTML.

`DocumentOutlineOptions` is the input to `useDocumentOutline(options?)`:

| Option | Type | Default / behavior |
| --- | --- | --- |
| `headings` | `readonly OutlineHeading[]` | Omitted: extract from scope. An explicit empty array disables extraction. |
| `scopeRef` | `RefObject<HTMLElement \| null>` | Omitted: no extraction, observation, or scrolling. |
| `scrollRootRef` | `RefObject<HTMLElement \| null>` | Omitted: viewport intersection root. |
| `observe` | `boolean` | `true`; use IntersectionObserver when available. |
| `rootMargin` | `string` | `"0px 0px -65% 0px"`; native IntersectionObserver syntax. Invalid syntax can throw a browser error. |
| `onActiveChange` | `(id: string \| null) => void` | Optional; receives initial `null` and subsequent changed active IDs. |

`useDocumentOutline` returns `{ headings, activeId, navigate }`. `headings` is a
readonly heading list, `activeId` is `string | null` (initially null), and
`navigate(id: string, behavior?: ScrollBehavior): boolean` defaults to smooth
scrolling. It returns false for unknown IDs; otherwise marks the heading active
and scrolls its matching scoped element if present. It does not change location,
move heading focus, or call the component's `onNavigate`.

`DocumentOutline(props: DocumentOutlineProps)` accepts all the options above plus:

| Prop | Type | Default / behavior |
| --- | --- | --- |
| `label` | `string` | `"On this page"`; accessible navigation name. |
| `className` | `string` | `""`; appended to `lp-outline`. |
| `style` | `CSSProperties` | Omitted; navigation inline style. |
| `emptyContent` | `ReactNode` | `null`; shown when the list is empty. |
| `onNavigate` | `(heading: OutlineHeading) => void` | Optional; called after a button activation requests navigation, including headings without matching DOM elements. |

`extractHeadings(scope: HTMLElement): OutlineHeading[]` reads descendant h1-h6
elements in DOM order, trims their `textContent`, and preserves existing IDs.
Missing IDs receive document-unique `outline-heading-N` IDs. This intentionally
mutates the DOM; assigned IDs remain after unmount. Existing duplicate IDs are
not repaired and are rejected by the hook. The scope element itself is excluded.

### Explicit data and hook usage

```tsx
import { useRef } from "react";
import {
  useDocumentOutline,
  extractHeadings,
  type OutlineHeading,
} from "@lp-labs/react-document-outline";

const headings: OutlineHeading[] = [
  { id: "summary", text: "Summary", level: 2 },
];

export function CustomOutline() {
  const scopeRef = useRef<HTMLElement>(null);
  const { activeId, navigate } = useDocumentOutline({ headings, scopeRef });
  return (
    <>
      <button onClick={() => navigate("summary", "auto")}>
        {activeId === "summary" ? "Current: " : ""}Summary
      </button>
      <article ref={scopeRef}>
        <h2 id="summary">Summary</h2>
        <button onClick={() => console.log(extractHeadings(scopeRef.current!))}>
          Inspect headings
        </button>
      </article>
    </>
  );
}
```

## Styling and accessibility

Import the CSS explicitly. Override `.lp-outline`, its `ol`, `li`, and `button`
rules or set `--outline-accent`. Indentation reflects the actual heading level.
The list is flat, not a generated nested document tree. Buttons remain in the
normal Tab order; ArrowUp/ArrowDown cycle focus, Home/End focus the first/last
button. Enter/Space activate native buttons. `aria-current="location"` identifies
the active item. Use `observe={false}` and custom hook navigation with `"auto"`
when smooth motion is undesirable. Apply `scroll-margin-top` to headings for
sticky headers.

## Browser and lifecycle limits

Refs must point to mounted elements when effects run; keep ref objects stable.
DOM extraction uses MutationObserver for text, child, and ID changes; observers
are disconnected on effect replacement/unmount. Observer constructors are read
from the scope's window. Without IntersectionObserver, navigation still updates
the active ID but scrolling does not automatically track sections. Among visible
headings the earliest in heading order wins; the last active heading is retained
when none intersect. No scroll-position restoration or heading-focus management
is performed. IDs are compared literally, never inserted into selectors.
Shadow roots and cross-document scrolling are not supported. React callbacks
may run twice under development Strict Mode.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.

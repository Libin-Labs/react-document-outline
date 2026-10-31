import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

export interface OutlineHeading {
  id: string;
  text: string;
  level: number;
}

export interface DocumentOutlineOptions {
  /** Explicit headings take precedence over DOM extraction, including an empty array. */
  headings?: readonly OutlineHeading[];
  scopeRef?: RefObject<HTMLElement | null>;
  scrollRootRef?: RefObject<HTMLElement | null>;
  observe?: boolean;
  rootMargin?: string;
  onActiveChange?: (id: string | null) => void;
}

/** Reads only h1-h6 descendants. Missing IDs are assigned without changing existing IDs. */
export function extractHeadings(scope: HTMLElement): OutlineHeading[] {
  const document = scope.ownerDocument;
  return Array.from(scope.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).map(
    (element, index) => {
      if (!element.id) {
        let suffix = index + 1;
        let id = `outline-heading-${suffix}`;
        while (document.getElementById(id)) id = `outline-heading-${++suffix}`;
        element.id = id;
      }
      return {
        id: element.id,
        text: element.textContent?.trim() ?? '',
        level: Number(element.tagName[1]),
      };
    },
  );
}

function findHeading(scope: HTMLElement | null, id: string): HTMLElement | null {
  // IDs are data, never interpolated into a CSS selector.
  return scope
    ? (Array.from(scope.querySelectorAll<HTMLElement>('[id]')).find(
        (element) => element.id === id,
      ) ?? null)
    : null;
}

function validateHeadings(headings: readonly OutlineHeading[]): void {
  const ids = new Set<string>();
  for (const heading of headings) {
    if (
      !heading.id ||
      ids.has(heading.id) ||
      !Number.isInteger(heading.level) ||
      heading.level < 1 ||
      heading.level > 6
    ) {
      throw new RangeError('Headings require unique nonempty IDs and integer levels from 1 to 6.');
    }
    ids.add(heading.id);
  }
}

export function useDocumentOutline({
  headings: explicit,
  scopeRef,
  scrollRootRef,
  observe = true,
  rootMargin = '0px 0px -65% 0px',
  onActiveChange,
}: DocumentOutlineOptions = {}) {
  const [extracted, setExtracted] = useState<OutlineHeading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const callback = useRef(onActiveChange);
  callback.current = onActiveChange;
  const headings = explicit ?? extracted;
  validateHeadings(headings);

  useEffect(() => {
    if (explicit !== undefined || !scopeRef?.current) return;
    const scope = scopeRef.current;
    const refresh = () => setExtracted(extractHeadings(scope));
    refresh();
    const MutationObserverClass = scope.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverClass) return;
    const observer = new MutationObserverClass(refresh);
    observer.observe(scope, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['id'],
    });
    return () => observer.disconnect();
  }, [explicit, scopeRef]);

  useEffect(() => {
    const scope = scopeRef?.current ?? null;
    const Observer = scope?.ownerDocument.defaultView?.IntersectionObserver;
    if (!observe || !scope || !Observer) return;
    const visible = new Set<string>();
    const observer = new Observer(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const next = headings.find((heading) => visible.has(heading.id))?.id;
        if (next) setActiveId(next);
      },
      { root: scrollRootRef?.current ?? null, rootMargin },
    );
    for (const heading of headings) {
      const element = findHeading(scope, heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings, observe, rootMargin, scopeRef, scrollRootRef]);

  useEffect(() => {
    if (activeId !== null && !headings.some((heading) => heading.id === activeId))
      setActiveId(null);
  }, [headings, activeId]);
  useEffect(() => {
    callback.current?.(activeId);
  }, [activeId]);

  const navigate = (id: string, behavior: ScrollBehavior = 'smooth') => {
    if (!headings.some((heading) => heading.id === id)) return false;
    const target = findHeading(scopeRef?.current ?? null, id);
    target?.scrollIntoView?.({ behavior, block: 'start' });
    setActiveId(id);
    return true;
  };
  return { headings, activeId, navigate };
}

export interface DocumentOutlineProps extends DocumentOutlineOptions {
  className?: string;
  style?: CSSProperties;
  label?: string;
  emptyContent?: ReactNode;
  onNavigate?: (heading: OutlineHeading) => void;
}

export function DocumentOutline({
  className = '',
  style,
  label = 'On this page',
  emptyContent = null,
  onNavigate,
  ...options
}: DocumentOutlineProps) {
  const { headings, activeId, navigate } = useDocumentOutline(options);
  const nav = useRef<HTMLElement>(null);
  return (
    <nav ref={nav} aria-label={label} className={`lp-outline ${className}`} style={style}>
      {headings.length === 0 ? (
        emptyContent
      ) : (
        <ol
          onKeyDown={(event) => {
            const buttons = Array.from(
              nav.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
            );
            const current = buttons.indexOf(event.target as HTMLButtonElement);
            if (current < 0) return;
            let next: number;
            if (event.key === 'ArrowDown') next = (current + 1) % buttons.length;
            else if (event.key === 'ArrowUp')
              next = (current - 1 + buttons.length) % buttons.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = buttons.length - 1;
            else return;
            event.preventDefault();
            buttons[next]?.focus();
          }}
        >
          {headings.map((heading) => (
            <li key={heading.id} style={{ paddingInlineStart: `${(heading.level - 1) * 0.75}rem` }}>
              <button
                type="button"
                aria-current={activeId === heading.id ? 'location' : undefined}
                onClick={() => {
                  navigate(heading.id);
                  onNavigate?.(heading);
                }}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

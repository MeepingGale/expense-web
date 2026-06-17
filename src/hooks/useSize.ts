import { useRef, useState, useLayoutEffect } from "react";

// width-measuring hook so SVG text never distorts (port of legacy/charts.jsx useSize)
export function useSize<T extends Element = HTMLDivElement>(): [React.RefObject<T | null>, number, number] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let rafId = 0;
    let stopped = false;
    const commit = (r: DOMRect | DOMRectReadOnly) =>
      setSize((prev) =>
        Math.abs(prev.w - r.width) > 0.5 || Math.abs(prev.h - r.height) > 0.5
          ? { w: r.width, h: r.height }
          : prev,
      );
    const poll = () => {
      if (stopped || !ref.current) return;
      const r = ref.current.getBoundingClientRect();
      if (r.width > 0) commit(r);
      else rafId = requestAnimationFrame(poll);
    };
    poll();
    const measure = () => { if (ref.current) commit(ref.current.getBoundingClientRect()); };
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const el = ref.current;
  const w = size.w || (el ? el.clientWidth : 0);
  const h = size.h || (el ? el.clientHeight : 0);
  return [ref, w, h];
}

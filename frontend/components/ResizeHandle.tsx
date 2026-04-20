import React, { useCallback, useRef, useEffect } from "react";

interface ResizeHandleProps {
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export default function ResizeHandle({
  onResize,
  minWidth = 280,
  maxWidth = 600,
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const isRtl = () => document.documentElement.dir === "rtl";

  const getPanel = () =>
    document.querySelector<HTMLElement>(".tracker-panel");

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const panel = getPanel();
      if (!panel) return;
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = panel.getBoundingClientRect().width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const delta = isRtl()
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const clamped = Math.min(
        Math.max(startWidth.current + delta, minWidth),
        Math.min(maxWidth, window.innerWidth * 0.5),
      );
      onResize(clamped);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onResize, minWidth, maxWidth]);

  return (
    <div className="resize-handle" onPointerDown={onPointerDown}>
      <div className="resize-handle-grip" />
    </div>
  );
}

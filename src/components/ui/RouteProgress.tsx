'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);

  function start() {
    setActive(true);
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    fallbackTimer.current = setTimeout(() => setActive(false), 12000);
  }

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setActive(false);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    }
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      start();
    }

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return;
      start();
    }

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="route-progress" role="progressbar" aria-label="Loading page">
      <span className="route-progress__bar" />
    </div>
  );
}

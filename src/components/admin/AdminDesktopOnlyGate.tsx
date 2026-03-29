import { useMemo, type PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';

const isMobileLike = () => {
  try {
    const ua = navigator.userAgent || '';
    const uaMobile = /android|iphone|ipod|ipad|iemobile|blackberry|opera mini|mobile/i.test(ua);
    const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    const small = window.matchMedia ? window.matchMedia('(max-width: 1023px)').matches : false;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return uaMobile || coarse || (touch && small);
  } catch {
    return false;
  }
};

export default function AdminDesktopOnlyGate({ children }: PropsWithChildren) {
  const blocked = useMemo(() => isMobileLike(), []);
  if (blocked) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { T } from '@dermaos/ui/ds';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let raf: number;

    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      const cx = mx - window.innerWidth / 2;
      const cy = my - window.innerHeight / 2;
      if (orb1Ref.current) orb1Ref.current.style.transform = `translate(${cx * 0.02}px, ${cy * 0.02}px)`;
      if (orb2Ref.current) orb2Ref.current.style.transform = `translate(${cx * 0.04}px, ${cy * 0.04}px)`;
      if (orb3Ref.current) orb3Ref.current.style.transform = `translate(${cx * 0.06}px, ${cy * 0.06}px)`;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'linear-gradient(155deg, #F6F6F6 0%, #EDEDED 100%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: T.textPrimary,
      }}
    >
      {/* Ambient orbs — follow mouse */}
      <div
        ref={orb1Ref}
        aria-hidden
        style={{
          position: 'absolute',
          top: -200,
          left: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: T.primary,
          filter: 'blur(80px)',
          opacity: 0.08,
          pointerEvents: 'none',
          transition: 'transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      />
      <div
        ref={orb2Ref}
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -150,
          right: -150,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: T.accent,
          filter: 'blur(80px)',
          opacity: 0.08,
          pointerEvents: 'none',
          transition: 'transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      />
      <div
        ref={orb3Ref}
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          marginTop: -200,
          marginLeft: -200,
          background: T.primaryLight,
          filter: 'blur(80px)',
          opacity: 0.08,
          pointerEvents: 'none',
          transition: 'transform 1.2s cubic-bezier(0.25,0.46,0.45,0.94)',
        }}
      />

      {/* Card slot */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 440,
        }}
      >
        {children}
      </div>

      <p
        style={{
          position: 'relative',
          zIndex: 10,
          marginTop: 24,
          fontSize: 11,
          color: T.textMuted,
          textAlign: 'center',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        © {new Date().getFullYear()} ElosMed · Plataforma Médica Integrada
      </p>
    </div>
  );
}

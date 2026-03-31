'use client';

import { useTheme } from '@/app/theme-provider';
import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

interface NavbarProps {
  onOpenLegal?: () => void;
}

export default function Navbar({ onOpenLegal }: NavbarProps) {
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const navbarRef = useRef<HTMLElement | null>(null);
  const COLLAPSE_THRESHOLD = 400;
  const TOP_ACTIVATION_ZONE = 36;

  const openNavbar = () => setIsCollapsed(false);

  const closeNavbar = () => {
    setIsCollapsed(true);
  };

  const updateNavbarFromPointer = (clientY: number) => {
    const navbar = navbarRef.current;
    const navbarRect = navbar?.getBoundingClientRect();
    const insideNavbar = navbarRect
      ? clientY >= navbarRect.top && clientY <= navbarRect.bottom
      : false;
    const insideTopActivationZone = clientY <= TOP_ACTIVATION_ZONE;

    if (insideNavbar || insideTopActivationZone) {
      openNavbar();
    } else if (window.scrollY > COLLAPSE_THRESHOLD) {
      setIsCollapsed(true);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;

      if (currentScrollY < COLLAPSE_THRESHOLD || !scrollingDown) {
        setIsCollapsed(false);
      } else if (currentScrollY >= COLLAPSE_THRESHOLD && scrollingDown) {
        setIsCollapsed(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateNavbarFromPointer(event.clientY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <>
      <nav
        ref={navbarRef}
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: 'linear-gradient(90deg, #6647fc, #eb6ea6)',
          transform: isCollapsed ? 'translateY(-66px)' : 'translateY(0)',
          transition: 'transform 220ms ease, box-shadow 200ms ease, background-color 200ms ease',
          boxShadow: isCollapsed ? '0 6px 18px rgba(0, 0, 0, 0.16)' : '0 14px 30px rgba(0, 0, 0, 0.22)',
        }}
      >
      {isCollapsed && (
        <div
          className="fixed top-0 left-0 right-0 h-4 z-[60]"
          onPointerEnter={openNavbar}
        />
      )}
      <div
        className="px-8 py-3 backdrop-blur-md flex-shrink-0 transition-colors duration-200"
        onPointerEnter={openNavbar}
        onPointerLeave={() => {
            if (window.scrollY >= COLLAPSE_THRESHOLD) {
            closeNavbar();
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg transform hover:scale-105 transition-transform" style={{
              background: 'linear-gradient(135deg, #6647fc, #eb6ea6)',
              color: 'var(--text-on-gradient)'
            }}>
              AI
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: 'var(--text-on-gradient)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
                }}
              >
                ChatBot IA
              </h1>
              <p className="text-xs font-medium" style={{ color: 'var(--text-on-gradient)' }}>Analyse intelligente en temps réel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLegal}
              className="px-3 py-2 rounded-lg transition-colors duration-200 text-xs font-semibold"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                opacity: 0.9,
                color: 'var(--text-on-gradient)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.28)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)')}
              aria-label="Ouvrir les mentions légales"
            >
              Mentions légales
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors duration-200 flex items-center justify-center"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                opacity: 0.9,
                color: 'var(--text-on-gradient)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.28)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)')}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon size={20} className="text-white" />
              ) : (
                <Sun size={20} className="text-yellow-300" />
              )}
            </button>
          </div>
        </div>
      </div>
      </nav>
    </>
  );
}

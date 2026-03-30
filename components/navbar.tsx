'use client';

import { useTheme } from '@/app/theme-provider';
import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY.current;

      if (currentScrollY < 40 || !scrollingDown) {
        setIsCollapsed(false);
      } else if (currentScrollY > 80) {
        setIsCollapsed(true);
      }

      lastScrollY.current = currentScrollY;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientY < 90) {
        setIsCollapsed(false);
      } else if (window.scrollY > 80) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
      background: 'linear-gradient(90deg, #6647fc, #eb6ea6)',
      transform: isCollapsed ? 'translateY(-66px)' : 'translateY(0)',
      transition: 'transform 220ms ease, box-shadow 200ms ease, background-color 200ms ease',
      boxShadow: isCollapsed ? '0 6px 18px rgba(0, 0, 0, 0.16)' : '0 14px 30px rgba(0, 0, 0, 0.22)',
    }}
    >
      <div className="px-8 py-3 backdrop-blur-md flex-shrink-0 transition-colors duration-200">
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
    </nav>
  );
}

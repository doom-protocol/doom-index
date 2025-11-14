"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FC, type SVGProps } from "react";

import { PumpFunIcon } from "@/components/icons/pump-fun-icon";
import { GitHubIcon } from "@/components/icons/github-icon";
import { XIcon } from "@/components/icons/x-icon";
import { InfoIcon } from "@/components/icons/info-icon";
import { ArchiveIcon } from "@/components/icons/archive-icon";
import { GITHUB_URL, X_URL } from "@/constants";

import { HeaderProgress } from "./header-progress";

type NavLinkConfig = {
  href: string;
  label: string;
  Icon: FC<SVGProps<SVGSVGElement>>;
};

const NAV_LINKS: NavLinkConfig[] = [
  {
    href: "https://pump.fun/coin/AJfn5M1bWeSsZDq89TgkKXm7AdtAQCsqzkYRxYGoqdev",
    label: "Pump.fun",
    Icon: PumpFunIcon,
  },
  {
    href: X_URL,
    label: "X",
    Icon: XIcon,
  },
  {
    href: GITHUB_URL,
    label: "GitHub",
    Icon: GitHubIcon,
  },
];

const DESKTOP_LINK_CLASS =
  "group flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/40 hover:text-white";

interface HeaderProps {
  showProgress?: boolean;
}

export const Header: FC<HeaderProps> = ({ showProgress = true }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuContainerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && menuContainerRef.current.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto md:px-4 px-2 py-3">
        <div className="grid w-full gap-y-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-x-6 md:gap-y-0">
          <div className="flex items-center justify-between md:justify-start">
            <Link
              href="/"
              className="text-white text-xl font-bold font-cinzel-decorative hover:text-white/80 transition-colors"
            >
              DOOM INDEX
            </Link>
            <div ref={menuContainerRef} className="relative flex items-center md:hidden">
              <button
                type="button"
                onClick={toggleMenu}
                aria-expanded={isMenuOpen}
                aria-controls="header-mobile-menu"
                className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                <span className="sr-only">Open Navigation Menu</span>
                <span aria-hidden className="pointer-events-none relative flex h-4 w-7 flex-col justify-between">
                  <span
                    className={`h-px w-full bg-current transition-transform duration-200 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
                  />
                  <span
                    className={`h-px w-full bg-current transition-opacity duration-200 ${isMenuOpen ? "opacity-0" : "opacity-100"}`}
                  />
                  <span
                    className={`h-px w-full bg-current transition-transform duration-200 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
                  />
                </span>
              </button>
              {isMenuOpen ? (
                <nav
                  id="header-mobile-menu"
                  aria-label="Navigation Links"
                  className="absolute right-0 top-full mt-3 flex w-48 flex-col gap-1 rounded-xl border border-white/20 bg-black/70 p-3 text-white/90 shadow-2xl backdrop-blur-xl"
                >
                  <Link
                    href="/about"
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white"
                    onClick={closeMenu}
                  >
                    <InfoIcon className="h-4 w-4" />
                    <span>About</span>
                  </Link>
                  <Link
                    href="/archive"
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white"
                    onClick={closeMenu}
                  >
                    <ArchiveIcon className="h-4 w-4" />
                    <span>Archive</span>
                  </Link>
                  {NAV_LINKS.map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-white/10 hover:text-white"
                      onClick={closeMenu}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-center md:justify-self-center">
            {showProgress ? <HeaderProgress /> : <div className="h-0 md:h-[68px]" aria-hidden="true" />}
          </div>
          <div className="hidden justify-end md:flex">
            <nav className="flex items-center justify-end gap-3" aria-label="Navigation Links">
              <Link
                href="/about"
                aria-label="About"
                className="group flex items-center justify-center px-4 py-1.5 text-sm text-white/70 transition-colors hover:text-white"
              >
                About
              </Link>
              <Link
                href="/archive"
                aria-label="Archive"
                className="group flex items-center justify-center px-4 py-1.5 text-sm text-white/70 transition-colors hover:text-white"
              >
                Archive
              </Link>
              {NAV_LINKS.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className={DESKTOP_LINK_CLASS}
                >
                  <Icon className="h-3 w-3" />
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

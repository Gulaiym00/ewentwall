"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { useNav } from "@/hooks/useNav";
import { Avatar } from "@/ui";
import { Icon } from "@/ui/icons";
import { saveLocale, type LandingDict } from "@/utils/i18n";

export default function Header({ locale, t }: { locale: Language; t: LandingDict["header"] }) {
  const { navigate, dark, toggleDark } = useNav();
  const { status, user } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, startSwitch] = useTransition();

  // The server renders the landing in the cookie's language, so save it and re-render.
  const switchLanguage = () => {
    saveLocale(locale === "en" ? "ru" : "en");
    startSwitch(() => router.refresh());
  };

  return (
    <header
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          height: 60,
        }}
        className="gap-4 px-5 sm:px-6 lg:gap-8"
      >
        {/* Logo */}
        <button
          onClick={() => navigate("landing")}
          aria-label={t.home}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "var(--accent)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" fill="white" stroke="white" />
            </svg>
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}
          >
            Event<span style={{ color: "var(--accent)" }}>Wall</span>
          </span>
        </button>

        {/* Nav – desktop */}
        <nav style={{ gap: 4, flex: 1 }} className="hidden lg:flex">
          {t.nav.map(
            (item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  color: "var(--text-2)",
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: "color 150ms",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-2)")
                }
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        {/* Right controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          {/* Lang */}
          <button
            onClick={switchLanguage}
            disabled={switching}
            aria-label={t.switchLanguage}
            style={{
              height: 34,
              padding: "0 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "none",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-2)",
              cursor: switching ? "wait" : "pointer",
              opacity: switching ? 0.6 : 1,
              letterSpacing: "0.05em",
            }}
          >
            {locale.toUpperCase()}
          </button>
          {/* Dark toggle */}
          <button
            onClick={toggleDark}
            aria-label={dark ? t.lightMode : t.darkMode}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-2)",
            }}
          >
            {dark ? (
              <Icon name="sun" size={18} />
            ) : (
              <Icon name="moon" size={18} />
            )}
          </button>
          {/* Signed in: avatar opens the profile. Signed out: "Sign in". */}
          {user ? (
            <Link
              href="/dashboard/profile"
              aria-label={t.profile}
              title={t.profile}
              style={{ display: "flex", borderRadius: "50%", flexShrink: 0 }}
            >
              <Avatar src={user.avatarUrl ?? undefined} name={user.name} size={34} />
            </Link>
          ) : status === "anonymous" ? (
            <button
              onClick={() => navigate("login")}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "none",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              className="hidden md:block"
            >
              {t.signIn}
            </button>
          ) : null}
          {/* CTA */}
          <button
            onClick={() => navigate(user ? "create-event" : "register")}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
            }}
            className="btn-press hidden md:block"
          >
            {t.createEvent}
          </button>
          {/* Mobile menu */}
          <button
            onClick={() => setMenuOpen((m) => !m)}
            aria-label={t.menu}
            aria-expanded={menuOpen}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "none",
              cursor: "pointer",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text)",
            }}
            className="flex lg:hidden"
          >
            {menuOpen ? (
              <Icon name="x" size={22} />
            ) : (
              <Icon name="menu" size={22} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            maxHeight: "calc(100dvh - 60px)",
            overflowY: "auto",
          }}
          className="fade-in px-5 pt-2 pb-5 sm:px-6 lg:hidden"
        >
          {t.nav.map(
            (item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "14px 0",
                  fontSize: 16,
                  color: "var(--text)",
                  textDecoration: "none",
                  fontWeight: 500,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {item.label}
              </a>
            ),
          )}
          <div style={{ marginTop: 16, gap: 10 }} className="flex md:hidden">
            <button
              onClick={() => (user ? router.push("/dashboard/profile") : navigate("login"))}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "none",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              {user ? t.profile : t.signIn}
            </button>
            <button
              onClick={() => navigate(user ? "create-event" : "register")}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.createEvent}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

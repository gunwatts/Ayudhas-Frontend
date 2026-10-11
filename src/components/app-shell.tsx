"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  ChevronDown,
  HandCoins,
  Handshake,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  NotebookPen,
  PiggyBank,
  Plus,
  Shapes,
  Sun,
  Target,
  TrendingUp,
  Users,
  Vault,
  Wallet,
  Inbox,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TransactionForm, type GenericKind } from "@/components/transaction-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "@/lib/session";
import { type ThemeChoice, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Money",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/transactions/", label: "Transactions", icon: ArrowLeftRight },
      { href: "/income/", label: "Income", icon: ArrowDownLeft },
      { href: "/expenses/", label: "Expenses", icon: ArrowUpRight },
      { href: "/accounts/", label: "Accounts", icon: Wallet },
      { href: "/budgets/", label: "Budgets", icon: Target },
    ],
  },
  {
    section: "Obligations",
    items: [
      { href: "/loans/", label: "Loans taken", icon: Landmark },
      { href: "/lent/", label: "Money lent", icon: HandCoins },
      { href: "/custody/", label: "Held for others", icon: Vault },
      { href: "/recurring/", label: "Recurring", icon: CalendarClock },
    ],
  },
  {
    section: "Growth",
    items: [
      { href: "/savings/", label: "Savings goals", icon: PiggyBank },
      { href: "/investments/", label: "Investments", icon: TrendingUp },
      { href: "/reports/", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/categories/", label: "Categories", icon: Shapes },
      { href: "/people/", label: "People", icon: Users },
      { href: "/notes/", label: "Notes", icon: NotebookPen },
    ],
  },
];

function isActive(pathname: string, href: string) {
  const p = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (href === "/") return p === "/";
  return p.startsWith(href);
}

const OWNER_NAV = { section: "Site", items: [{ href: "/messages/", label: "Messages", icon: Inbox }] };

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useSession();
  const groups = user?.is_staff ? [...NAV, OWNER_NAV] : NAV;
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.section}>
          <p className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{group.section}</p>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2 px-3 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Handshake className="size-4" aria-hidden />
      </span>
      Finance Tracker
    </Link>
  );
}

export function QuickAdd({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (o: boolean) => void; kind: GenericKind }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>Income, spending or a move between your own accounts.</DialogDescription>
        </DialogHeader>
        {open && <TransactionForm defaultKind={kind} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

const THEME_ICON: Record<ThemeChoice, React.ComponentType<{ className?: string }>> = { light: Sun, dark: Moon, system: Monitor };

function UserMenu() {
  const { user, logout } = useSession();
  const { choice, setChoice } = useTheme();
  const router = useRouter();
  const ThemeIcon = THEME_ICON[choice];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" aria-label="Account menu">
          <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">{user?.username.slice(0, 2)}</span>
          <span className="hidden max-w-32 truncate text-sm sm:inline">{user?.username}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2 font-normal text-muted-foreground">
          <ThemeIcon className="size-4" /> Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={choice} onValueChange={(v) => setChoice(v as ThemeChoice)}>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings/")}>
          <KeyRound /> Change password
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            // Local sign-out happens even if the server call fails, so always go to the login page.
            logout()
              .catch(() => {})
              .finally(() => router.replace("/login/"));
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const pathname = usePathname();
  const quickKind: GenericKind = pathname.startsWith("/income") ? "income" : "expense";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setQuickAdd(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-sidebar py-5 pr-3 pl-3 lg:flex">
        <Brand />
        <NavList />
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-5">
            <Brand />
          </div>
          <NavList onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="flex-1" />
          <Button onClick={() => setQuickAdd(true)} className="gap-1.5" aria-keyshortcuts="n" aria-label="Add transaction">
            <Plus /> <span className="hidden sm:inline">Add transaction</span>
            <kbd className="ml-1 hidden rounded border border-primary-foreground/30 px-1 text-[10px] font-medium opacity-80 sm:inline">N</kbd>
          </Button>
          <UserMenu />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>

      <QuickAdd open={quickAdd} onOpenChange={setQuickAdd} kind={quickKind} />
    </div>
  );
}

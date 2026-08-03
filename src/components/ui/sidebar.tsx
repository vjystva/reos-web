"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Collapsible application sidebar.
 *
 * Layout model — no width math is done in JS: `SidebarProvider` is a flex row,
 * `Sidebar` renders an in-flow spacer (desktop only) plus a `fixed` dark panel
 * of the same width, and `SidebarInset` is simply `flex-1`. Below the `lg`
 * breakpoint the panel is replaced by a `Sheet` drawer.
 *
 *   <SidebarProvider>
 *     <Sidebar>
 *       <SidebarHeader>…</SidebarHeader>
 *       <SidebarContent>
 *         <SidebarGroup>
 *           <SidebarGroupLabel>Sales</SidebarGroupLabel>
 *           <SidebarMenu>
 *             <SidebarMenuItem>
 *               <SidebarMenuButton asChild isActive tooltip="Leads">
 *                 <Link href="/leads"><Users /><span>Leads</span></Link>
 *               </SidebarMenuButton>
 *             </SidebarMenuItem>
 *           </SidebarMenu>
 *         </SidebarGroup>
 *       </SidebarContent>
 *     </Sidebar>
 *     <SidebarInset>
 *       <SidebarTrigger />
 *       {children}
 *     </SidebarInset>
 *   </SidebarProvider>
 *
 * Convention: a `SidebarMenuButton` child is `<Icon /> + <span>Label</span>`.
 * When collapsed to icon-only, direct `<span>` children are hidden and the
 * `tooltip` prop is surfaced on hover instead.
 */

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_STORAGE_KEY = "reos:sidebar:open";
const SIDEBAR_MOBILE_BREAKPOINT = 1024; // Tailwind `lg`
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextValue {
  /** Desktop open/collapsed state. */
  open: boolean;
  setOpen: (open: boolean) => void;
  state: SidebarState;
  /** Mobile drawer state. */
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  /** Toggles the drawer on mobile, the collapsed state on desktop. */
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within a <SidebarProvider>");
  }
  return ctx;
}

/** Internal — avoids touching src/hooks/*. */
function useIsMobile(breakpoint = SIDEBAR_MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return isMobile;
}

export interface SidebarProviderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  /** Controlled mode — pass with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  SidebarProviderProps
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

    const open = openProp ?? uncontrolledOpen;

    // Restore persisted state after mount (keeps SSR markup deterministic).
    React.useEffect(() => {
      if (openProp !== undefined) return;
      try {
        const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored === "true" || stored === "false") {
          setUncontrolledOpen(stored === "true");
        }
      } catch {
        /* storage unavailable (private mode / SSR) — keep the default */
      }
    }, [openProp]);

    const setOpen = React.useCallback(
      (value: boolean) => {
        onOpenChange?.(value);
        if (openProp === undefined) setUncontrolledOpen(value);
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
        } catch {
          /* ignore */
        }
      },
      [onOpenChange, openProp],
    );

    const toggleSidebar = React.useCallback(() => {
      if (isMobile) {
        setOpenMobile((v) => !v);
        return;
      }
      setOpen(!open);
    }, [isMobile, open, setOpen]);

    // Cmd/Ctrl + B
    React.useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (
          event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [toggleSidebar]);

    const value = React.useMemo<SidebarContextValue>(
      () => ({
        open,
        setOpen,
        state: open ? "expanded" : "collapsed",
        openMobile,
        setOpenMobile,
        isMobile,
        toggleSidebar,
      }),
      [open, setOpen, openMobile, isMobile, toggleSidebar],
    );

    return (
      <SidebarContext.Provider value={value}>
        <TooltipProvider delayDuration={100}>
          <div
            ref={ref}
            data-sidebar-state={value.state}
            className={cn("flex min-h-screen w-full bg-background", className)}
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = "SidebarProvider";

const sidebarPanelClasses =
  "flex h-full flex-col gap-1 bg-sidebar text-sidebar-foreground";

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "left" | "right";
}

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, children, side = "left", ...props }, ref) => {
    const { isMobile, openMobile, setOpenMobile, state } = useSidebar();
    const width = state === "expanded" ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON;

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetContent
            side={side}
            className={cn(
              sidebarPanelClasses,
              "w-[--sidebar-width] max-w-[85vw] border-sidebar-border p-0 sm:max-w-[--sidebar-width]",
              className,
            )}
            style={
              { "--sidebar-width": SIDEBAR_WIDTH } as React.CSSProperties
            }
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {children}
          </SheetContent>
        </Sheet>
      );
    }

    return (
      <>
        {/* in-flow spacer — pushes SidebarInset without any JS width math */}
        <div
          aria-hidden
          className="hidden shrink-0 transition-[width] duration-200 ease-linear lg:block"
          style={{ width }}
        />
        <div
          ref={ref}
          data-state={state}
          data-side={side}
          className={cn(
            "fixed inset-y-0 z-30 hidden transition-[width] duration-200 ease-linear lg:flex",
            side === "left"
              ? "left-0 border-r border-sidebar-border"
              : "right-0 border-l border-sidebar-border",
            sidebarPanelClasses,
            className,
          )}
          style={{ width }}
          {...props}
        >
          {children}
        </div>
      </>
    );
  },
);
Sidebar.displayName = "Sidebar";

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-2",
      className,
    )}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden py-2",
      className,
    )}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-auto flex shrink-0 flex-col gap-1 border-t border-sidebar-border p-2",
      className,
    )}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mx-2 h-px shrink-0 bg-sidebar-border", className)}
    {...props}
  />
));
SidebarSeparator.displayName = "SidebarSeparator";

export const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex w-full min-w-0 flex-col px-2", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

/** Hidden entirely when the rail is collapsed to icon-only. */
export const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  return (
    <div
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50",
        collapsed && "sr-only",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("group/menu-item relative", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
  "flex w-full items-center gap-2 overflow-hidden rounded-md text-left text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        ghost:
          "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-8 px-2",
        sm: "h-7 px-2 text-[11px]",
        lg: "h-9 px-2 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface SidebarMenuButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
  /** Shown on hover only while the rail is collapsed to icon-only. */
  tooltip?: React.ReactNode;
}

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    {
      asChild = false,
      isActive = false,
      tooltip,
      variant,
      size,
      className,
      ...props
    },
    ref,
  ) => {
    const { state, isMobile } = useSidebar();
    const collapsed = state === "collapsed" && !isMobile;
    const Comp = asChild ? Slot : "button";

    const button = (
      <Comp
        ref={ref}
        data-active={isActive || undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }),
          isActive &&
            "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-sidebar-primary",
          // icon-only: centre the glyph and hide the text label
          collapsed && "justify-center px-0 [&>span]:hidden",
          className,
        )}
        {...props}
      />
    );

    if (!collapsed || !tooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

/** Small right-aligned count/status slot inside a menu button row. */
export const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-sm bg-sidebar-accent px-1 py-0.5 font-mono text-[10px] tabular-nums text-sidebar-accent-foreground",
        collapsed && "hidden",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuBadge.displayName = "SidebarMenuBadge";

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Toggle sidebar"
      title="Toggle sidebar (⌘B)"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

/** Main content column. Sits next to the sidebar spacer inside the provider. */
export const SidebarInset = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    className={cn(
      "flex min-h-screen w-full min-w-0 flex-1 flex-col bg-background",
      className,
    )}
    {...props}
  />
));
SidebarInset.displayName = "SidebarInset";

export {
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_KEYBOARD_SHORTCUT,
  sidebarMenuButtonVariants,
};

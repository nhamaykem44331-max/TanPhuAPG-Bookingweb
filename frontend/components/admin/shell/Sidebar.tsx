"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Bell, PanelLeft, Plus, Search, X } from "lucide-react";

import { AccountBlock } from "@/components/admin/shell/AccountBlock";
import { NAV_ICONS } from "@/components/admin/shell/nav-icons";
import { OflyMark } from "@/components/admin/shell/OflyMark";
import {
  isNavItemActive,
  workspaceOfPath,
  type AdminNav,
  type AdminNavItem,
  type AdminNavKey,
  type AdminWorkspace,
} from "@/lib/admin/nav";

// Sidebar theo đúng bố cục Manager (`apps/web/src/shell.tsx`):
// thương hiệu · hàng công cụ · Tổng quan · bộ chuyển KHÔNG GIAN LÀM VIỆC ·
// nút hành động nhanh · spacer · khối tài khoản.
// Mục con của không gian KHÔNG nằm ở đây nữa — chúng ra sub-nav pills ngang (TopSubNav).

const COLLAPSE_KEY = "ofly-sidebar-collapsed";

interface SidebarUser {
  fullName: string;
  email: string;
  roleLabel: string;
  initial: string;
}

interface SidebarProps {
  nav: AdminNav;
  badges: Partial<Record<AdminNavKey, number>>;
  user: SidebarUser;
  logoutAction: () => void | Promise<void>;
  onNavigate?: () => void;
  onClose?: () => void;
}

const toolBtnStyle: CSSProperties = {
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: 9,
  border: "1px solid var(--line2)",
  background: "var(--paper2)",
  color: "var(--ink3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// Ở dạng drawer (mobile) vùng bấm phải đạt tối thiểu 44×44 theo hợp đồng §8;
// cột cố định desktop dùng chuột nên giữ 34×34 cho gọn.
const toolBtnDrawerStyle: CSSProperties = { ...toolBtnStyle, width: 44, height: 44 };

const railBtnStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "var(--ink3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function Sidebar({ nav, badges, user, logoutAction, onNavigate, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [collapsedPref, setCollapsedPref] = useState(false);

  // Drawer mobile luôn ở dạng đầy đủ — thu gọn chỉ có nghĩa với cột cố định desktop.
  const isDrawer = Boolean(onClose);
  const collapsed = !isDrawer && collapsedPref;
  const toolBtn = isDrawer ? toolBtnDrawerStyle : toolBtnStyle;

  useEffect(() => {
    if (isDrawer) return;
    setCollapsedPref(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, [isDrawer]);

  function setCollapsed(next: boolean) {
    setCollapsedPref(next);
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  }

  const activeWorkspace = workspaceOfPath(pathname);
  // Nút "Lập báo giá" chỉ hiện khi role thật sự được vào màn đó.
  const quoteItem = nav.workspaces.flatMap((ws) => ws.items).find((item) => item.key === "quote") ?? null;

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    onNavigate?.();
    router.push(value ? `/admin/bookings?q=${encodeURIComponent(value)}` : "/admin/bookings");
  }

  function pickWorkspace(workspace: AdminWorkspace): string {
    return workspace.items[0]?.href ?? "/admin";
  }

  return (
    <aside
      className="flex h-full flex-none flex-col border-r border-[var(--line)] bg-[var(--paper)]"
      style={{ width: collapsed ? 72 : 228, transition: "width 0.2s ease" }}
    >
      {/* A · thương hiệu + B · hàng công cụ */}
      {collapsed ? (
        <>
          <div className="flex h-16 flex-none items-center justify-center">
            <Link href={nav.home?.href ?? "/admin"} onClick={onNavigate} aria-label="Về Tổng quan" className="flex">
              <OflyMark size={34} showWordmark={false} />
            </Link>
          </div>
          <div className="flex flex-col items-center gap-1 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Mở rộng"
              aria-label="Mở rộng thanh bên"
              style={railBtnStyle}
            >
              <PanelLeft size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              title="Tìm kiếm"
              aria-label="Tìm kiếm"
              style={railBtnStyle}
            >
              <Search size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-none items-center" style={{ height: 56, padding: "0 12px 0 14px" }}>
            <Link
              href={nav.home?.href ?? "/admin"}
              onClick={onNavigate}
              aria-label="Về Tổng quan"
              className="flex w-full min-w-0 items-center"
            >
              <OflyMark />
            </Link>
          </div>
          <div className="flex flex-none items-center" style={{ gap: 6, padding: "0 10px 8px" }}>
            {/* Ô nhập bỏ outline nên vòng focus chuyển lên khung bọc (giống SearchBox ở
                ui/Field.tsx) — nếu không người dùng bàn phím tab vào sẽ không thấy gì. */}
            <form
              onSubmit={onSearchSubmit}
              className={`flex min-w-0 flex-1 items-center gap-[8px] rounded-[9px] border border-[var(--line2)] bg-[var(--paper2)] px-[10px] transition-[border-color,background-color] duration-150 focus-within:border-[var(--ink)] focus-within:bg-[var(--paper)] ${
                isDrawer ? "h-[44px]" : "h-[34px]"
              }`}
            >
              <Search size={15} strokeWidth={1.5} style={{ color: "var(--ink3)", flexShrink: 0 }} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm kiếm…"
                aria-label="Tìm đơn"
                className="min-w-0 flex-1 border-none bg-transparent outline-none placeholder:text-[var(--ink4)]"
                style={{ fontFamily: "var(--sans)", fontSize: 12.5, color: "var(--ink)" }}
              />
            </form>
            <Link
              href="/admin/queue"
              onClick={onNavigate}
              title="Hàng đợi xuất vé"
              aria-label="Hàng đợi xuất vé"
              style={toolBtn}
            >
              <Bell size={16} strokeWidth={1.5} aria-hidden="true" />
            </Link>
            {isDrawer ? (
              <button type="button" onClick={onClose} title="Đóng menu" aria-label="Đóng menu" style={toolBtn}>
                <X size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                title="Thu gọn"
                aria-label="Thu gọn thanh bên"
                style={toolBtnStyle}
              >
                <PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>
        </>
      )}

      {/* C · mục "nhà" — Tổng quan */}
      {nav.home ? (
        <div style={{ padding: collapsed ? "0 12px 6px" : "2px 10px 6px" }}>
          <HomeNavBtn
            item={nav.home}
            active={isNavItemActive(pathname, nav.home.href)}
            badge={nav.home.badgeKey ? badges[nav.home.badgeKey] : undefined}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        </div>
      ) : null}

      {/* D · bộ chuyển KHÔNG GIAN LÀM VIỆC */}
      {collapsed ? (
        <div
          className="flex flex-col items-center gap-1"
          style={{
            padding: "6px 0",
            margin: "0 12px",
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {nav.workspaces.map((workspace) => {
            const on = activeWorkspace?.id === workspace.id;
            const Icon = NAV_ICONS[workspace.icon];
            return (
              <Link
                key={workspace.id}
                href={pickWorkspace(workspace)}
                onClick={onNavigate}
                title={workspace.label}
                aria-label={workspace.label}
                style={{
                  width: 44,
                  height: 40,
                  borderRadius: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: on ? "var(--rustTint)" : "transparent",
                  color: on ? "var(--rust)" : "var(--ink2)",
                }}
              >
                <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: "0 10px 10px" }}>
          <div
            style={{
              fontFamily: "var(--sans)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "var(--ink3)",
              padding: "4px 6px 8px",
            }}
          >
            Không gian làm việc
          </div>
          <div className="flex flex-col gap-[3px]">
            {nav.workspaces.map((workspace) => {
              const on = activeWorkspace?.id === workspace.id;
              const Icon = NAV_ICONS[workspace.icon];
              return (
                <Link
                  key={workspace.id}
                  href={pickWorkspace(workspace)}
                  onClick={onNavigate}
                  aria-current={on ? "true" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${on ? "var(--rust)" : "transparent"}`,
                    background: on ? "var(--rustTint)" : "transparent",
                    transition: "all 0.13s",
                  }}
                  onMouseEnter={(event) => {
                    if (!on) event.currentTarget.style.background = "var(--paper2)";
                  }}
                  onMouseLeave={(event) => {
                    if (!on) event.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: on ? "var(--rust)" : "var(--paper2)",
                      // --rust ở theme tối là navy nhạt, không phải navy đặc → dùng
                      // token --onInk cho khớp badge phía dưới thay vì hex #FFF.
                      color: on ? "var(--onInk)" : "var(--ink2)",
                    }}
                  >
                    <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--sans)",
                      fontSize: 13,
                      fontWeight: on ? 700 : 600,
                      color: on ? "var(--rust)" : "var(--ink)",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {workspace.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* E · hành động nhanh */}
      {quoteItem ? (
        <div style={{ padding: collapsed ? "8px 0" : "0 10px 10px" }}>
          <Link
            href={quoteItem.href}
            onClick={onNavigate}
            title={quoteItem.label}
            aria-label={quoteItem.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              background: "var(--gradGreen)",
              color: "#FFF",
              boxShadow: "0 6px 16px -8px rgba(14,50,88,0.7)",
              ...(collapsed
                ? { width: 44, height: 44, margin: "0 auto", borderRadius: 11 }
                : { width: "100%", padding: "11px 14px", borderRadius: 11 }),
            }}
          >
            <Plus size={collapsed ? 20 : 17} strokeWidth={1.9} aria-hidden="true" />
            {collapsed ? null : (
              <span style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 600 }}>{quoteItem.label}</span>
            )}
          </Link>
        </div>
      ) : null}

      {/* F · spacer đẩy khối tài khoản xuống đáy */}
      <div style={{ flex: 1, minHeight: 12 }} />

      {/* G · tài khoản */}
      <AccountBlock
        collapsed={collapsed}
        user={user}
        system={nav.system}
        logoutAction={logoutAction}
        onNavigate={onNavigate}
      />
    </aside>
  );
}

// Hàng nav kiểu Manager: thanh dọc rust sát mép trái khi active.
function HomeNavBtn({
  item,
  active,
  badge,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  badge?: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = NAV_ICONS[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        padding: collapsed ? "10px 0" : "8px 11px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: 8,
        background: active ? "var(--paper3)" : "transparent",
        transition: "background 0.13s",
      }}
      onMouseEnter={(event) => {
        if (!active) event.currentTarget.style.background = "var(--paper2)";
      }}
      onMouseLeave={(event) => {
        if (!active) event.currentTarget.style.background = "transparent";
      }}
    >
      {active && !collapsed ? (
        <span
          style={{ position: "absolute", left: 0, top: 7, bottom: 7, width: 3, borderRadius: 3, background: "var(--rust)" }}
        />
      ) : null}
      <Icon
        size={collapsed ? 20 : 17}
        strokeWidth={active ? 1.9 : 1.5}
        aria-hidden="true"
        style={{ flexShrink: 0, color: active ? "var(--rust)" : "var(--ink3)" }}
      />
      {collapsed ? null : (
        <span
          style={{
            flex: 1,
            fontFamily: "var(--sans)",
            fontSize: 13,
            fontWeight: active ? 600 : 500,
            color: active ? "var(--ink)" : "var(--ink2)",
            letterSpacing: "0.1px",
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </span>
      )}
      {typeof badge === "number" && badge > 0 && !collapsed ? (
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            fontWeight: 600,
            minWidth: 20,
            textAlign: "center",
            padding: "1px 6px",
            borderRadius: 100,
            background: active ? "var(--rust)" : "var(--paper2)",
            color: active ? "var(--onInk)" : "var(--ink3)",
            border: active ? "none" : "1px solid var(--line2)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

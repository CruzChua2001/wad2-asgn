import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AppLayout from "../layout";

vi.mock("next/navigation", () => ({ usePathname: () => "/project" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light", vi.fn()] }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../scan/scan-context", () => ({ ScanProvider: ({ children }) => children, useScan: () => ({ resetScan: vi.fn() }) }));
vi.mock("../scan/profile-menu", () => ({ default: () => null }));
vi.mock("@/components/animated-theme-toggler", () => ({ default: () => null }));
vi.mock("@/components/tour/product-tour", () => ({ default: () => null }));
vi.mock("@/components/ask-cruz/ask-cruz-panel", () => ({ default: () => null }));

test("shared navigation offers Scan and Projects, without the scrapped Learn destination", () => {
    render(<AppLayout>Project content</AppLayout>);
    const links = within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link");
    expect(links.map(link => [link.textContent, link.getAttribute("href")])).toEqual([["Scan", "/scan"], ["Projects", "/project"]]);
    expect(screen.queryByRole("link", { name: "Learn" })).toBeNull();
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/features/dashboard/page-header";

describe("PageHeader", () => {
  it("renders dashboard page title and description", () => {
    render(<PageHeader title="Admin" description="Manage the workspace." />);

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Manage the workspace.")).toBeInTheDocument();
  });
});

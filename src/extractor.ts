import type { Page } from "playwright";
import type { OrderStatus, EtaInfo } from "./types.ts";

export interface PageExtraction {
  restaurantName: string;
  status: OrderStatus;
  eta: EtaInfo;
}

/**
 * Extracts order status data from the Wolt tracking page DOM.
 * Runs evaluation inside the browser context.
 */
export async function extractPageData(page: Page): Promise<PageExtraction> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const restaurantName = h1?.textContent?.trim() ?? "Unknown";

    // Parse ETA and status label from page title: "22min - Being delivered"
    const title = document.title;
    const titleMatch = title.match(/^(\d+)min\s*-\s*(.+)$/);
    const etaMinutes = titleMatch ? parseInt(titleMatch[1]!, 10) : null;
    const statusLabel = titleMatch?.[2]?.trim() ?? "";

    // Find the active step: it has a filled/colored circle with a number
    // Steps use an ordered list or divs. We look for the h2 which is the active status description.
    const h2 = document.querySelector("h2");
    const statusDescription = h2?.textContent?.trim() ?? "";

    // Determine the step number by counting completed steps + 1 for active.
    // Completed steps have SVG checkmarks, active step has a number in a colored circle.
    // We look at all step container elements.
    let activeStep = 0;
    let activeDescription = "";

    // The step list is typically rendered as a series of divs with step content.
    // Each step has either a checkmark SVG (completed) or a number.
    // The active step container is visually distinct (usually has a border/highlight).
    const allStepTexts = [
      "That's it, we have your order",
      "A human being has seen your order",
      "Your order is being prepared",
      "Your order is ready and is being delivered",
      "Your order has been delivered",
    ];

    // Strategy: find the h2 content and match it to known step patterns.
    const h2Text = h2?.textContent?.toLowerCase() ?? "";

    if (h2Text.includes("we have your order")) {
      activeStep = 1;
    } else if (h2Text.includes("human being has seen")) {
      activeStep = 2;
    } else if (h2Text.includes("being prepared")) {
      activeStep = 3;
    } else if (h2Text.includes("being delivered")) {
      activeStep = 4;
    } else if (h2Text.includes("has been delivered")) {
      activeStep = 5;
    }

    // Fallback: count SVG elements (checkmarks) in the step list area
    if (activeStep === 0) {
      const svgs = document.querySelectorAll("svg");
      let checkmarkCount = 0;
      for (const svg of svgs) {
        const parent = svg.closest("[class]");
        if (parent && parent.querySelector("polyline, path[d*='M']")) {
          checkmarkCount++;
        }
      }
      activeStep = Math.min(checkmarkCount + 1, 5);
    }

    // Find the subtitle/description below the active step heading
    const h2Parent = h2?.parentElement;
    if (h2Parent) {
      const siblingP = h2Parent.querySelector("p, span:last-child, div > span");
      if (siblingP && siblingP !== h2) {
        activeDescription = siblingP.textContent?.trim() ?? "";
      }
    }

    // Also try to get description from elements after h2
    if (!activeDescription) {
      let nextEl = h2?.nextElementSibling;
      while (nextEl) {
        const text = nextEl.textContent?.trim();
        if (text && text.length > 5 && text !== statusDescription) {
          activeDescription = text;
          break;
        }
        nextEl = nextEl.nextElementSibling;
      }
    }

    return {
      restaurantName,
      status: {
        step: activeStep || 1,
        label: statusLabel || statusDescription,
        description: activeDescription || statusDescription,
      },
      eta: {
        minutes: etaMinutes,
        rawText: etaMinutes !== null ? `${etaMinutes} minutes until delivery` : "N/A",
      },
    };
  });
}

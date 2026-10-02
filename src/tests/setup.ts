import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom doesn't implement the modal <dialog> API; this covers what Sheet uses.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.show) {
    proto.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.close) {
    proto.close = function close(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

// jsdom doesn't lay out, so it has no scrollIntoView (the Haushalt page scrolls to #profil).
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

afterEach(() => {
  cleanup();
});

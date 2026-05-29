// ==UserScript==
// @name         SN2 Companion -> Subnautica2.gg Map
// @namespace    local.sn2-companion
// @version      0.1
// @description  Reads local SN2 companion JSON and submits current position to subnautica2.gg/map
// @match        https://subnautica2.gg/map*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const COMPANION_STATUS_URL = "http://127.0.0.1:8787/status";
  const UPDATE_EVERY_MS = 2000;

  // Flat maps usually want in-game X + Z, because Y is depth.
  // If the website marker is wrong, try changing second field to 'y'.
  const WEBSITE_FIRST_COORD = "x";
  const WEBSITE_SECOND_COORD = "y";

  let lastSubmitted = "";

  function requestJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 3000,
        onload: (res) => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch (err) {
            reject(err);
          }
        },
        onerror: reject,
        ontimeout: () => reject(new Error("Companion server timed out")),
      });
    });
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;

    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findPositionInputs() {
    const visibleInputs = [...document.querySelectorAll("input")]
      .filter(isVisible)
      .filter((input) => {
        const type = (input.type || "").toLowerCase();
        return (
          type === "text" ||
          type === "number" ||
          type === "search" ||
          type === ""
        );
      });

    // The map currently exposes two visible coordinate inputs in the Position panel.
    if (visibleInputs.length >= 2) {
      return visibleInputs.slice(-2);
    }

    return [];
  }

  function findSetButton() {
    return [
      ...document.querySelectorAll(
        'button, input[type="button"], input[type="submit"]',
      ),
    ]
      .filter(isVisible)
      .find((el) => {
        const text = (el.innerText || el.value || "").trim().toLowerCase();
        return text === "set";
      });
  }

  function clickPositionTabIfNeeded() {
    const positionTab = [
      ...document.querySelectorAll('button, a, [role="tab"]'),
    ]
      .filter(isVisible)
      .find((el) => (el.innerText || "").trim().toLowerCase() === "position");

    if (positionTab) {
      positionTab.click();
    }
  }

  async function syncPosition() {
    try {
      const state = await requestJson(COMPANION_STATUS_URL);

      const first = Number(state[WEBSITE_FIRST_COORD]);
      const second = Number(state[WEBSITE_SECOND_COORD]);

      if (!Number.isFinite(first) || !Number.isFinite(second)) {
        console.warn("[SN2 Companion] Bad position JSON:", state);
        return;
      }

      const roundedFirst = Math.round(first).toString();
      const roundedSecond = Math.round(second).toString();
      const key = `${roundedFirst},${roundedSecond}`;

      if (key === lastSubmitted) return;

      clickPositionTabIfNeeded();

      const inputs = findPositionInputs();
      const setButton = findSetButton();

      if (inputs.length < 2 || !setButton) {
        console.warn(
          "[SN2 Companion] Could not find map coordinate inputs or Set button.",
        );
        return;
      }

      setNativeValue(inputs[0], roundedFirst);
      setNativeValue(inputs[1], roundedSecond);
      setButton.click();

      lastSubmitted = key;
      console.log(`[SN2 Companion] Submitted position ${key}`);
    } catch (err) {
      console.warn("[SN2 Companion] Could not read companion server:", err);
    }
  }

  setTimeout(syncPosition, 1500);
  setInterval(syncPosition, UPDATE_EVERY_MS);
})();

  type OverlayEl = HTMLElement & { __contactOverlayInit?: boolean };
  type FieldEl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  type LenisLike = {
    scroll: number;
    scrollTo: (target: number, opts?: { immediate?: boolean }) => void;
    stop: () => void;
    start: () => void;
  };

  function getLenis(): LenisLike | undefined {
    return (window as unknown as { __lenis?: LenisLike }).__lenis;
  }

  const STEP_LABELS: Record<number, string> = {
    1: "Personal Details",
    2: "Project Details",
    3: "Vision & Alignment",
  };
  void STEP_LABELS;

  const TOTAL_STEPS = 3;

  type SanitizeKind = "name" | "email" | "phone" | "number" | "text" | "multiline";

  const FIELD_KIND: Record<string, SanitizeKind> = {
    fullName: "name",
    email: "email",
    phone: "phone",
    age: "number",
    location: "text",
    size: "number",
    vision: "text",
  };

  const ALLOW: Record<SanitizeKind, RegExp> = {
    name: /[^\p{L}\p{M}'’.\-\s]/gu,
    email: /[^A-Za-z0-9._%+\-@]/g,
    phone: /[^0-9+\-()\s]/g,
    number: /[^0-9]/g,
    text: /[^\p{L}\p{M}\p{N}'’.,;:!?&()\-/#\s]/gu,
    multiline: /[^\p{L}\p{M}\p{N}'’.,;:!?&()\-/#\s\n\r]/gu,
  };

  const MAX_LEN: Record<string, number> = {
    fullName: 80,
    email: 254,
    phone: 20,
    location: 120,
    vision: 200,
  };

  function stripControlChars(value: string): string {
    return value.replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g,
      "",
    );
  }

  function sanitizeField(field: FieldEl): void {
    const kind = FIELD_KIND[field.name];
    if (!kind) return;

    let value = field.value;

    const cleaned = stripControlChars(value);
    if (cleaned !== value) value = cleaned;

    const filtered = value.replace(ALLOW[kind], "");
    if (filtered !== value) value = filtered;

    const cap = MAX_LEN[field.name];
    if (typeof cap === "number" && value.length > cap) {
      value = value.slice(0, cap);
    }

    if (value !== field.value) {
      const el = field as HTMLInputElement;
      const start = el.selectionStart ?? value.length;
      const delta = field.value.length - value.length;

      el.value = value;
      try {
        const pos = Math.max(0, start - delta);
        el.setSelectionRange(pos, pos);
      } catch {
        // setSelectionRange is not supported on some input types.
      }
    }
  }

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled]):not([hidden])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  function getFocusable(root: HTMLElement): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => {
        if (el.hasAttribute("hidden")) return false;
        if (el.closest("[hidden]")) return false;
        if (el.closest("[aria-hidden='true']")) return false;
        return el.offsetParent !== null || el === document.activeElement;
      },
    );
  }

  function getFieldError(field: FieldEl): string {
    const v = field.validity;

    const label = (field.labels?.[0]?.textContent ?? field.name ?? "This field")
      .replace(/\s*\*\s*$/, "")
      .trim();

    if (v.valueMissing) {
      if (field instanceof HTMLSelectElement) {
        return `Please select a ${label.toLowerCase()}.`;
      }
      return `${label} is required.`;
    }

    if (v.typeMismatch) {
      if (field.type === "email") return "Please enter a valid email address.";
      return `${label} is not valid.`;
    }

    if (v.patternMismatch) {
      if (field.name === "fullName") {
        return "Please use letters, spaces, hyphens, apostrophes, or periods only.";
      }
      if (field.name === "email") {
        return "Please enter a valid email address (e.g. name@example.com).";
      }
      if (field.name === "phone") {
        return "Please enter a valid phone number (digits, +, -, spaces, parentheses).";
      }
      if (field.name === "location") {
        return "Please use letters, numbers, spaces, commas, and hyphens only.";
      }
      if (field.name === "vision") {
        return "Please use plain text without special or control characters.";
      }
      return `${label} is not in the expected format.`;
    }

    if (v.tooShort) {
      const min = field.getAttribute("minlength") ?? "";
      return `${label} must be at least ${min} characters.`;
    }
    if (v.tooLong) {
      const max = field.getAttribute("maxlength") ?? "";
      return `${label} must be at most ${max} characters.`;
    }
    if (v.rangeUnderflow) {
      const min = field.getAttribute("min") ?? "";
      return `${label} must be at least ${min}.`;
    }
    if (v.rangeOverflow) {
      const max = field.getAttribute("max") ?? "";
      return `${label} must be at most ${max}.`;
    }
    if (v.stepMismatch) return `${label} must be a whole number.`;
    if (v.badInput) return `Please enter a valid value for ${label.toLowerCase()}.`;

    return field.validationMessage || `${label} is invalid.`;
  }

  class ContactOverlay {
    private root: OverlayEl;
    private panel: HTMLElement;
    private form: HTMLFormElement;
    private backdrop: HTMLElement;
    private closeBtn: HTMLButtonElement;
    private prevBtn: HTMLButtonElement;
    private nextBtn: HTMLButtonElement;
    private submitBtn: HTMLButtonElement;
    private stepEls: HTMLElement[];
    private progressBar: HTMLElement;
    private successState: HTMLElement;

    private currentStep = 1;
    private lastFocused: HTMLElement | null = null;
    private scrollLockY = 0;

    private scrollStyles: {
      htmlOverflow: string;
      bodyOverflow: string;
    } | null = null;

    private submitController: AbortController | null = null;

    private boundKeydown = (e: KeyboardEvent) => this.onKeydown(e);
    private boundWheel = (e: WheelEvent) => this.onWheel(e);

    private boundOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id || detail.id === this.root.id) this.open();
    };

    private boundClose = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id || detail.id === this.root.id) this.close();
    };

    constructor(root: OverlayEl) {
      this.root = root;
      this.panel = root.querySelector<HTMLElement>("[data-overlay-panel]")!;
      this.form = root.querySelector<HTMLFormElement>("[data-overlay-form]")!;
      this.backdrop = root.querySelector<HTMLElement>("[data-overlay-backdrop]")!;
      this.closeBtn = root.querySelector<HTMLButtonElement>("[data-overlay-close]")!;
      this.prevBtn = root.querySelector<HTMLButtonElement>("[data-step-prev]")!;
      this.nextBtn = root.querySelector<HTMLButtonElement>("[data-step-next]")!;
      this.submitBtn = root.querySelector<HTMLButtonElement>("[data-step-submit]")!;
      this.stepEls = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
      this.progressBar = root.querySelector<HTMLElement>("[data-progress-bar]")!;
      this.successState = root.querySelector<HTMLElement>("[data-success-state]")!;
    }

    init(): void {
      if (this.root.__contactOverlayInit) return;
      this.root.__contactOverlayInit = true;

      this.closeBtn.addEventListener("click", () => this.close());
      this.backdrop.addEventListener("click", () => this.close());
      this.nextBtn.addEventListener("click", () => this.goNext());
      this.prevBtn.addEventListener("click", () => this.goPrev());
      this.form.addEventListener("submit", (e) => void this.onSubmit(e));

      // ---- Input hardening ----
      this.form.addEventListener(
        "beforeinput",
        (e) => {
          if (e.isComposing || e.inputType === "insertCompositionText") return;

          const target = e.target as HTMLElement | null;
          if (!(target instanceof HTMLInputElement)) return;
          if (typeof e.data !== "string" || e.data.length === 0) return;

          const kind = FIELD_KIND[target.name];
          if (!kind) return;

          const allow = ALLOW[kind];
          const clean = e.data.replace(allow, "");
          if (clean === e.data) return;

          e.preventDefault();

          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          const next = target.value.slice(0, start) + clean + target.value.slice(end);
          const cap = MAX_LEN[target.name];
          target.value = typeof cap === "number" ? next.slice(0, cap) : next;

          const pos = start + clean.length;
          try {
            target.setSelectionRange(pos, pos);
          } catch {
            /* ignore */
          }
        },
        { capture: true },
      );

      this.form.addEventListener("input", (e) => {
        const target = e.target as HTMLElement | null;
        if (!(target instanceof HTMLInputElement)) return;

        sanitizeField(target);

        if (this.hasError(target) && target.checkValidity()) {
          this.clearFieldError(target);
        }
      });

      this.form.addEventListener("change", (e) => {
        const target = e.target as HTMLElement | null;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.checkValidity()) this.clearFieldError(target);
      });

      this.form.addEventListener(
        "blur",
        (e) => {
          const target = e.target as HTMLElement | null;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
          ) {
            if (!target.checkValidity()) this.showFieldError(target);
          }
        },
        true,
      );

      this.form.addEventListener(
        "keydown",
        (e) => {
          const target = e.target as HTMLElement | null;
          if (target instanceof HTMLInputElement && target.type === "number") {
            const blocked = ["e", "E", "+", "-"];
            if (blocked.includes(e.key)) e.preventDefault();
          }
        },
        { capture: true },
      );

      document.addEventListener("wheel", this.boundWheel, {
        capture: true,
        passive: false,
      });
      document.addEventListener("keydown", this.boundKeydown);
      document.addEventListener("contact-overlay:open", this.boundOpen);
      document.addEventListener("contact-overlay:close", this.boundClose);

      this.renderStep();

      // Respect server-rendered initial open state.
      if (this.root.dataset.state === "open") {
        this.lockScroll();
        requestAnimationFrame(() => {
          const focusables = getFocusable(this.panel);
          (focusables[0] ?? this.panel).focus();
        });
      }
    }

    destroy(): void {
      document.removeEventListener("keydown", this.boundKeydown);
      document.removeEventListener("wheel", this.boundWheel, true);
      document.removeEventListener("contact-overlay:open", this.boundOpen);
      document.removeEventListener("contact-overlay:close", this.boundClose);
      this.submitController?.abort();
      this.submitController = null;
      this.unlockScroll();
    }

    isOpen(): boolean {
      return this.root.dataset.state === "open";
    }

    open(): void {
      if (this.isOpen()) return;

      this.lastFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      this.lockScroll();

      this.root.dataset.state = "open";
      this.root.setAttribute("aria-hidden", "false");

      requestAnimationFrame(() => {
        const focusables = getFocusable(this.panel);
        (focusables[0] ?? this.panel).focus();
      });

      this.root.dispatchEvent(new CustomEvent("contact-overlay:opened", { bubbles: true }));
    }

    close(): void {
      if (!this.isOpen()) return;

      this.submitController?.abort();
      this.submitController = null;

      this.root.dataset.state = "closed";
      this.root.setAttribute("aria-hidden", "true");

      this.resetSuccessState();
      this.setStatus(null);
      this.form.reset();

      this.currentStep = 1;
      this.renderStep();

      this.unlockScroll();

      if (this.lastFocused && document.contains(this.lastFocused)) {
        this.lastFocused.focus();
      }

      this.root.dispatchEvent(new CustomEvent("contact-overlay:closed", { bubbles: true }));
    }

    private lockScroll(): void {
      const html = document.documentElement;
      const body = document.body;

      this.scrollLockY = getLenis()?.scroll ?? window.scrollY;

      this.scrollStyles = {
        htmlOverflow: html.style.overflow,
        bodyOverflow: body.style.overflow,
      };

      getLenis()?.stop();
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    }

    private unlockScroll(): void {
      const html = document.documentElement;
      const body = document.body;

      if (!this.scrollStyles) return;

      html.style.overflow = this.scrollStyles.htmlOverflow;
      body.style.overflow = this.scrollStyles.bodyOverflow;
      this.scrollStyles = null;

      getLenis()?.scrollTo(this.scrollLockY, { immediate: true });
      getLenis()?.start();
    }

    private onWheel(e: WheelEvent): void {
      if (!this.isOpen()) return;

      e.preventDefault();

      let deltaY = e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) deltaY *= 16;
      else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) deltaY *= this.panel.clientHeight;

      this.panel.scrollTop += deltaY;
    }

    private onKeydown(e: KeyboardEvent): void {
      if (!this.isOpen()) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === "Tab") {
        const focusables = getFocusable(this.panel);

        if (focusables.length === 0) {
          e.preventDefault();
          this.panel.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !this.panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !this.panel.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    private renderStep(): void {
      this.stepEls.forEach((el) => {
        const step = Number(el.dataset.step);
        el.hidden = step !== this.currentStep;
      });

      this.prevBtn.hidden = this.currentStep === 1;
      this.nextBtn.hidden = this.currentStep === TOTAL_STEPS;
      this.submitBtn.hidden = this.currentStep !== TOTAL_STEPS;

      const progress = (this.currentStep / TOTAL_STEPS) * 100;
      this.progressBar.style.width = `${progress}%`;

      this.root
        .querySelector<HTMLElement>("[role='progressbar']")
        ?.setAttribute("aria-valuenow", String(this.currentStep));
    }

    private showSuccess(): void {
      this.form.hidden = true;
      this.successState.classList.remove("hidden");
      this.successState.classList.add("flex");
      this.successState.focus();
    }

    private resetSuccessState(): void {
      this.form.hidden = false;
      this.successState.classList.add("hidden");
      this.successState.classList.remove("flex");
    }

    private setStatus(message: string | null): void {
      const el = this.form.querySelector<HTMLElement>("[data-overlay-status]");
      if (!el) return;
      if (message) {
        el.textContent = message;
        el.hidden = false;
      } else {
        el.textContent = "";
        el.hidden = true;
      }
    }

    private errorElFor(field: FieldEl): HTMLElement | null {
      if (!field.id) return null;
      return this.form.querySelector<HTMLElement>(
        `[data-error-for="${CSS.escape(field.id)}"]`,
      );
    }

    private hasError(field: FieldEl): boolean {
      const el = this.errorElFor(field);
      return !!el && !el.hidden;
    }

    private showFieldError(field: FieldEl): void {
      const el = this.errorElFor(field);
      if (!el) return;

      el.textContent = getFieldError(field);
      el.hidden = false;

      field.setAttribute("aria-invalid", "true");
      if (field.id) {
        el.id = `${field.id}-error`;
        field.setAttribute("aria-describedby", el.id);
      }
    }

    private clearFieldError(field: FieldEl): void {
      const el = this.errorElFor(field);
      if (el) {
        el.hidden = true;
        el.textContent = "";
      }
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    }

    private validateStep(step: number, { focus = false } = {}): boolean {
      const el = this.stepEls.find((s) => Number(s.dataset.step) === step);
      if (!el) return true;

      const fields = Array.from(
        el.querySelectorAll<FieldEl>("input, select, textarea"),
      ).filter((field) => {
        if (field.hasAttribute("data-honeypot")) return false;
        if ((field as HTMLInputElement).disabled) return false;
        return true;
      });

      let firstInvalid: FieldEl | null = null;

      for (const field of fields) {
        if (field instanceof HTMLInputElement) sanitizeField(field);

        if (field.checkValidity()) {
          this.clearFieldError(field);
        } else {
          this.showFieldError(field);
          if (!firstInvalid) firstInvalid = field;
        }
      }

      if (firstInvalid && focus) firstInvalid.focus();
      return !firstInvalid;
    }

    private validateCurrentStep(): boolean {
      return this.validateStep(this.currentStep, { focus: true });
    }

    private goNext(): void {
      if (!this.validateCurrentStep()) return;
      if (this.currentStep < TOTAL_STEPS) {
        this.currentStep += 1;
        this.renderStep();
        this.focusFirstField();
      }
    }

    private goPrev(): void {
      if (this.currentStep > 1) {
        this.currentStep -= 1;
        this.renderStep();
        this.focusFirstField();
      }
    }

    private focusFirstField(): void {
      requestAnimationFrame(() => {
        const current = this.stepEls.find(
          (el) => Number(el.dataset.step) === this.currentStep,
        );
        if (!current) return;
        current
          .querySelector<HTMLElement>("input, select, textarea, button")
          ?.focus();
      });
    }

    private async onSubmit(e: SubmitEvent): Promise<void> {
      e.preventDefault();
      this.setStatus(null);

      // Honeypot
      const honeypot = this.form.querySelector<HTMLInputElement>("[data-honeypot]");
      if (honeypot && honeypot.value.trim() !== "") return;

      // Sanitize every input
      this.form
        .querySelectorAll<HTMLInputElement>("input:not([type=hidden])")
        .forEach((input) => {
          if (input.hasAttribute("data-honeypot")) return;
          sanitizeField(input);
        });

      // Validate every step without mutating currentStep.
      for (let step = 1; step <= TOTAL_STEPS; step++) {
        if (!this.validateStep(step)) {
          this.currentStep = step;
          this.renderStep();
          this.focusFirstField();
          return;
        }
      }

      // Build normalized payload
      const payload: Record<string, string> = {};
      this.form.querySelectorAll<FieldEl>("input, select, textarea").forEach((field) => {
        if (!field.name) return;
        if (field.hasAttribute("data-honeypot")) return;

        let value = field.value.trim();

        if (field.type === "number" && value !== "") {
          const n = Number(value);
          value = Number.isFinite(n) ? String(n) : "";
        }

        value = stripControlChars(value);
        payload[field.name] = value;
      });

      // Disable the form while in-flight.
      const fields = Array.from(
        this.form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"),
      ).filter((el) => !el.hasAttribute("data-honeypot"));
      fields.forEach((el) => (el.disabled = false));

      this.submitBtn.disabled = true;
      this.nextBtn.disabled = true;
      this.prevBtn.disabled = true;

      const originalSubmitText = this.submitBtn.textContent;
      this.submitBtn.textContent = "( Sending... )";

      this.submitController?.abort();
      const controller = new AbortController();
      this.submitController = controller;

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const result: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "message" in result &&
            typeof (result as { message: unknown }).message === "string"
              ? (result as { message: string }).message
              : "Unable to send your enquiry.";
          throw new Error(message);
        }

        // Overlay was closed mid-flight — do not mutate UI state.
        if (!this.isOpen() || controller.signal.aborted) return;

        this.root.dispatchEvent(
          new CustomEvent("contact-overlay:submit", {
            bubbles: true,
            detail: { formData: new FormData(this.form) },
          }),
        );

        this.form.reset();
        this.currentStep = 1;
        this.renderStep();
        this.showSuccess();
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        if (!this.isOpen()) return;

        this.setStatus(
          error instanceof Error
            ? error.message
            : "Unable to send your enquiry right now. Please try again.",
        );
      } finally {
        fields.forEach((el) => (el.disabled = false));
        this.submitBtn.disabled = false;
        this.nextBtn.disabled = false;
        this.prevBtn.disabled = false;
        this.submitBtn.textContent = originalSubmitText;

        if (this.submitController === controller) this.submitController = null;
      }
    }
  }

  function initOverlays(): void {
    document.querySelectorAll<OverlayEl>("[data-contact-overlay]").forEach((el) => {
      if (el.__contactOverlayInit) return;

      const instance = new ContactOverlay(el);
      instance.init();

      (el as OverlayEl & { __contactOverlay?: ContactOverlay }).__contactOverlay =
        instance;
    });
  }

  function destroyOverlays(): void {
    document.querySelectorAll<OverlayEl>("[data-contact-overlay]").forEach((el) => {
      const instance = (el as OverlayEl & { __contactOverlay?: ContactOverlay })
        .__contactOverlay;
      instance?.destroy();
      delete (el as OverlayEl & { __contactOverlay?: ContactOverlay }).__contactOverlay;
    });
  }

  initOverlays();
  document.addEventListener("astro:before-swap", destroyOverlays);
  document.addEventListener("astro:page-load", initOverlays);

import { browser } from "wxt/browser";
import type { AuthUser } from "@promptizer/shared";
import { accountSession, API_ORIGIN } from "../../account/account-session";
import type { AuthClientError } from "../../account/auth-client";
import { banner, button, footerNote, headerSub, screenShell, sectionHeading, setButtonBusy } from "../components";
import { el } from "../dom";
import type { Dispatch } from "../types";

const SIGN_UP_URL = `${API_ORIGIN}/sign-up`;
const DASHBOARD_URL = API_ORIGIN;

function openInTab(url: string): void {
  void browser.tabs.create({ url });
}

function labelledInput(id: string, label: string, type: string, autocomplete: string): HTMLElement {
  return el("div", { class: "pz-field" }, [
    el("label", { class: "pz-field-label pz-caption", for: id }, [label]),
    el("input", { id, type, class: "pz-input", autocomplete, required: "true" }),
  ]);
}

function errorMessage(error: AuthClientError): string {
  return error.message;
}

function renderSignedOut(dispatch: Dispatch): HTMLElement[] {
  const errorHost = el("div", {});
  const emailField = labelledInput("pz-account-email", "Email", "email", "username");
  const passwordField = labelledInput("pz-account-password", "Password", "password", "current-password");
  const form = el("form", { class: "pz-account-form", novalidate: "true" }, [emailField, passwordField]);
  const submit = button({ label: "Sign in" });
  submit.setAttribute("type", "submit");
  form.append(submit);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailField.querySelector("input")?.value ?? "";
    const password = passwordField.querySelector("input")?.value ?? "";
    setButtonBusy(submit, true);
    const result = await accountSession.signIn(email, password);
    setButtonBusy(submit, false);
    if (result.ok) {
      dispatch.announce("Signed in");
      dispatch.rerender();
      return;
    }
    errorHost.replaceChildren(banner({ kind: "danger", text: errorMessage(result.error) }));
  });

  return [
    sectionHeading("Sign in", "Use your Promptizer account."),
    errorHost,
    form,
    button({ label: "Create an account", variant: "outline", onClick: () => openInTab(SIGN_UP_URL) }),
  ];
}

function renderSignedIn(dispatch: Dispatch, user: AuthUser): HTMLElement[] {
  return [
    sectionHeading("Signed in", user.email),
    el("p", { class: "pz-body" }, [user.name]),
    footerNote("Library sync will appear here."),
    button({ label: "Open dashboard", variant: "outline", onClick: () => openInTab(DASHBOARD_URL) }),
    button({
      label: "Sign out",
      variant: "danger",
      onClick: async () => {
        await accountSession.signOut();
        dispatch.announce("Signed out");
        dispatch.rerender();
      },
    }),
  ];
}

export function renderAccountScreen(dispatch: Dispatch): HTMLElement {
  const body = el("div", { class: "pz-account-body" });
  void accountSession.confirmedUser().then((user) => {
    body.replaceChildren(...(user === undefined ? renderSignedOut(dispatch) : renderSignedIn(dispatch, user)));
  });
  return screenShell(headerSub({ title: "Account" }), [body]);
}

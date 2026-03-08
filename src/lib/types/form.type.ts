import type { ActionResult } from "@sveltejs/kit"
import type { LoginData } from "./auth.type"

export type FormEnhance = {
  formElement: HTMLFormElement // `formElement` is this `<form>` element
  formData: FormData // `formData` is its `FormData` object that's about to be submitted
  action: URL // `action` is the URL to which the form is posted
  cancel: () => void // calling `cancel()` will prevent the submission
  submitter: HTMLElement | null // `submitter` is the `HTMLElement` that caused the form to be submitted
}

export type ResultEnhance = {
  result: FormResponseEnhance<LoginData>  // `result` is an `ActionResult` object
  update: () => Promise<void> // `update` is a function which triggers the default logic that would be triggered
}

type FormResponseEnhance<T> = 
  | {
      type: "success";
      status: number;
      data: {
        success: true;
        data: T;
      };
    }
  | {
      type: "failure";
      status: number;
      data: {
        errors: {
          formErrors: string[];
          fieldErrors: Record<string, string[]>;
        };
      };
    };
/**
 * The Cite section's copy buttons. Each button ships hidden in the page, `data-copy` naming the element whose text it
 * copies, and is shown only where the browser offers a clipboard, so a button that cannot copy never appears.
 */

// How long a button reads "Copied" (or the fallback hint) before it reads "Copy" again, in milliseconds.
const CONFIRMATION_MS = 2000;

const COPY_LABEL = "Copy";
const COPIED_LABEL = "Copied";
// What a button says when the clipboard refuses the text: the reader can still select the block and copy it.
const FAILED_LABEL = "Select and copy";

/**
 * Show every `button[data-copy]` under `root` whose source element exists, and copy the source's text to
 * `clipboard` on a click; with no clipboard (null or undefined), leave every button hidden.
 */
export function mountCopyButtons(root, clipboard) {
  if (!clipboard) {
    return;
  }
  for (const button of root.querySelectorAll("button[data-copy]")) {
    const source = root.getElementById(button.dataset.copy);
    if (source === null) {
      continue;
    }
    button.hidden = false;
    button.addEventListener("click", () => copySource(button, source, clipboard));
  }
}

/**
 * Write the text of `source`, trimmed, to `clipboard`, and say on `button` whether it was copied; the button reads
 * "Copy" again after a moment. Settles once the label is set.
 */
export async function copySource(button, source, clipboard) {
  try {
    await clipboard.writeText(source.textContent.trim());
    button.textContent = COPIED_LABEL;
  } catch (error) {
    console.error("The citation could not be copied", error);
    button.textContent = FAILED_LABEL;
  }
  setTimeout(() => {
    button.textContent = COPY_LABEL;
  }, CONFIRMATION_MS);
}

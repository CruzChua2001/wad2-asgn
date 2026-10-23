import { withTerms } from "./glossary";

// A fix is plain text: one line, or numbered steps with `code`, ``` blocks and a Tip: line
function parseFix(text) {
  const blocks = [];
  let fence = null;
  let steps = null;

  for (const line of text.split("\n")) {
    if (line.trim() === "```") {
      if (fence) {
        blocks.push({ kind: "pre", text: fence.join("\n") });
        fence = null;
      } else {
        fence = [];
      }
      steps = null;
      continue;
    }

    if (fence) {
      fence.push(line);
      continue;
    }

    const step = line.match(/^(\d+)\.\s+(.*)$/);
    if (step) {
      if (!steps) {
        steps = { kind: "steps", start: Number(step[1]), steps: [] };
        blocks.push(steps);
      }
      steps.steps.push(step[2]);
      continue;
    }

    steps = null;

    if (line.trim().startsWith("Tip:")) {
      blocks.push({ kind: "tip", text: line.trim().slice(4).trim() });
    } else if (line.trim()) {
      blocks.push({ kind: "p", text: line.trim() });
    }
  }

  if (fence) {
    blocks.push({ kind: "pre", text: fence.join("\n") });
  }

  return blocks;
}

// `code` stays as typed, and the words around it still get T19's glossary terms
function fixInline(text) {
  return text.split("`").map((part, index) => (index % 2 === 1
    ? <code key={index} className="rounded bg-surface-soft px-1 font-mono text-xs! break-all">{part}</code>
    : <span key={index}>{withTerms(part)}</span>));
}

// Each step reads "Label: what to do", so the label is bold
function fixStep(text) {
  const colon = text.indexOf(":");
  const tick = text.indexOf("`");

  if (colon === -1 || (tick !== -1 && tick < colon)) {
    return fixInline(text);
  }

  return <><strong>{text.slice(0, colon + 1)}</strong> {fixInline(text.slice(colon + 1).trim())}</>;
}

// Used by the Overview's findings and the Report Card's "Fix these first"
export default function FixText({ text, label = "What to do:" }) {
  const blocks = parseFix(text);

  // A one-line fix reads as a sentence after the label, like it always has
  if (blocks.length === 1 && blocks[0].kind === "p") {
    return <span className="mt-1.5 block">{label && <strong>{label} </strong>}{fixInline(blocks[0].text)}</span>;
  }

  return (
    <div className="mt-1.5">
      {label && <strong>{label}</strong>}
      <div className="mt-1 flex flex-col gap-1.5">
        {blocks.map((block, index) => {
          if (block.kind === "pre") {
            return (
              <pre key={index} className="m-0 max-w-full overflow-x-auto rounded border border-line bg-surface-soft p-2 font-mono text-xs!">
                {block.text}
              </pre>
            );
          }

          if (block.kind === "steps") {
            return (
              <ol key={index} start={block.start} className="m-0 list-decimal space-y-1 pl-5">
                {block.steps.map((step, stepIndex) => <li key={stepIndex}>{fixStep(step)}</li>)}
              </ol>
            );
          }

          if (block.kind === "tip") {
            return (
              <p key={index} className="m-0 text-muted">
                <span aria-hidden="true">💡 </span><strong>Tip:</strong> {fixInline(block.text)}
              </p>
            );
          }

          return <p key={index} className="m-0">{fixInline(block.text)}</p>;
        })}
      </div>
    </div>
  );
}

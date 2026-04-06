import { useMemo, useState } from "react";

const LINE_HEIGHT = 24;

const DEFAULT_CODE = `arr = [5, 3, 1, 4, 2]
for i in range(len(arr)):
    for j in range(0, len(arr) - i - 1):
        if arr[j] > arr[j + 1]:
            arr[j], arr[j + 1] = arr[j + 1], arr[j]`;

export function CodeEditor({
  code,
  arrayVar,
  errorLine,
  isLoading,
  onCodeChange,
  onArrayVarChange,
  onRun,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = useMemo(() => Math.max(code.split("\n").length, 1), [code]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount]
  );

  const handleRun = async () => {
    await onRun();
  };

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>Python Algorithm</h2>
          <p>Paste your own sorting or search logic and trace how it executes.</p>
        </div>
        <button className="primary-button" type="button" onClick={handleRun} disabled={isLoading}>
          {isLoading ? "Running..." : "Run"}
        </button>
      </div>

      <label className="field">
        <span>Array variable name</span>
        <input
          className="text-input"
          type="text"
          value={arrayVar}
          onChange={(event) => onArrayVarChange(event.target.value)}
          placeholder="arr"
        />
      </label>

      <div className="editor-shell">
        <div className="editor-lines" style={{ transform: `translateY(-${scrollTop}px)` }}>
          {lineNumbers.map((lineNumber) => (
            <div
              key={lineNumber}
              className={`editor-line-number${errorLine === lineNumber ? " is-error" : ""}`}
              style={{ height: `${LINE_HEIGHT}px` }}
            >
              {lineNumber}
            </div>
          ))}
        </div>

        <div className="editor-surface">
          {errorLine ? (
            <div
              className="editor-error-highlight"
              style={{
                top: `${(errorLine - 1) * LINE_HEIGHT - scrollTop}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          ) : null}

          <textarea
            className="code-textarea"
            spellCheck="false"
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            onScroll={(event) => setScrollTop(event.target.scrollTop)}
          />
        </div>
      </div>

      <div className="editor-footnote">
        <button className="secondary-button" type="button" onClick={() => onCodeChange(DEFAULT_CODE)}>
          Load bubble sort example
        </button>
      </div>
    </section>
  );
}

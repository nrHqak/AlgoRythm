# Trace Protocol v1

This is the core execution result produced by the Pyodide worker using the single
canonical `frontend/src/runtime/tracer.py` AlgorithmTracer. Future changes must
preserve this baseline unless the protocol is explicitly revised. Backend APIs
never execute user Python source.

```json
{
  "trace_version": 1,
  "steps": [
    {
      "step": 0,
      "line": 2,
      "event": "step",
      "array": [3, 1],
      "highlights": [],
      "locals": {},
      "error": null
    }
  ],
  "error": null,
  "total_steps": 1,
  "truncated": false
}
```

## Result fields

| Field | Meaning |
| --- | --- |
| `trace_version` | Integer `1`, identifying this execution contract, including empty/error results. |
| `steps` | Ordered snapshots of eligible user-code lines and runtime exceptions; may be empty. |
| `error` | `null` or `{type, message, line}`. `type` and `message` are strings; `line` is a one-based source line. Timeout uses synthetic line `1`. |
| `total_steps` | Number of emitted snapshots, always `len(steps)`, including error snapshots. |
| `truncated` | Boolean indicating execution was stopped by the trace step cap, rather than completed. A cap is not an execution error. |

## Step fields

| Field | Meaning |
| --- | --- |
| `step` | Contiguous zero-based index in `steps`. |
| `line` | One-based line in the submitted source; only frames compiled as `<user_code>` are traced. |
| `event` | Visualization hint inferred from the source line, or `error` for an exception snapshot. |
| `array` | Snapshot of the selected `array_var` when it holds a list or tuple. Tuples are represented as lists. |
| `highlights` | Deduplicated candidate indices, in candidate-variable order, clamped to the array bounds when the array is nonempty. For an empty array the raw integer values are retained. |
| `locals` | Snapshot of frame-local variables, excluding names starting with `__` and the selected array variable when represented in `array`. Other locals remain available. Primitive values are preserved, lists/tuples recursively become lists, dictionaries have string keys and recursively sanitized values, and other objects use `repr`. |
| `error` | Normally `null`; an `error` snapshot carries the same structured payload as the top-level error. |

Highlight candidates, in order: `i`, `j`, `mid`, `left`, `right`, `low`, `high`,
`min_idx`, `current`, `pivot_idx`.

## Snapshot and event semantics

Line snapshots occur **before** that line executes. The array initialization line
usually has no snapshot because the selected variable does not exist yet. A final
mutation on the last line has no automatic post-execution snapshot. To observe a
completed state in a comparison program, append another executable line. Steps
are skipped if the selected variable is absent or is neither a list nor tuple;
an empty array is skipped after any prior snapshot.

The selected list/tuple is represented once in `array`, rather than duplicated
under `locals[array_var]`. This is compatible with v1's dynamic locals dictionary;
consumers must read the selected array from `step.array`. Proactive mentor context
includes that field explicitly. Primitive array items are immutable, so an outer
list copy preserves their history; nested list/tuple values are deep-copied to
prevent later mutations changing earlier steps. Other locals retain recursive
sanitization. Each execution precomputes the existing line-event heuristic once
per source line, with unchanged detection priority and source semantics.

Events are heuristic source labels, not proof that an operation completed.
Detection priority is `found`, `swap`, `shift`, `write`, `search`, `compare`, then
`step`:

| Event | Current detection |
| --- | --- |
| `step` | Default eligible line. |
| `compare` | `if`, `elif`, or `while` with selected-array indexing and a comparison operator. |
| `swap` | Tuple assignment exchanging two selected-array elements, with matching index text. |
| `shift` | Single selected-array element assigned from another selected-array element. |
| `write` | Selected-array element assignment that is not a shift. |
| `search` | A comparison line containing `target`, `key`, `pivot`, `needle`, or `value` (case-insensitive substring matching). |
| `found` | A line starting with `return `, or containing `=` and `result`, `found`, `return`, or `break`, without `[`. This can label initialization such as `result = -1`. |
| `error` | First traced runtime exception with an available array snapshot. |

## Failures and limits

- Syntax errors produce no steps and a top-level `SyntaxError`. The current engine
  falls back to line `1` because no user-code traceback frame exists, even when
  the parser's actual error is on another line.
- Runtime errors preserve prior steps. The first traced exception sets the
  top-level error and adds an error snapshot if an array is available. The current
  tracer also records caught exceptions; `error` does not prove the program exited.
- Timeout terminates the worker and returns no steps, `total_steps: 0`,
  `truncated: false`, and error type `timeout`, with synthetic line `1`. Partial
  traces are not recovered. The default timeout is two seconds; the current
  message formats the configured timeout as an integer number of seconds.
- The default step cap is 300. Execution stops immediately when an eligible line
  appends the cap-th snapshot, before that line executes. This marks
  `truncated: true` even if that line would have been the last. Normal truncation
  has `error: null`.

The existing MemoryError message still says "sandbox memory limit" for v1
compatibility; it does not imply a browser memory quota.

## Outside the core protocol

`algorithm_type` and `algorithm_confidence` are asynchronous classifier enrichment
and do not belong to Trace Protocol v1. Historical server timing diagnostics are
preserved only in migration reports; the worker does not emit them.

## Browser adapter

BrowserEngine resolves worker trace results, including Python compile/runtime
errors. A hard timeout terminates/reloads the worker and rejects execution with
a canonical timeout result attached as `error.trace`. The frontend `executeTrace`
adapter converts that timeout to the empty trace above. Infrastructure failures
remain request errors; initialization/recovery failure shows runtime unavailable
and Retry. This lifecycle distinction does not change visualization semantics.

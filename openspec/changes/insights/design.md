# Design: insights

## 1. Order and names

Hero → Overview (`#overview`) → Sessions (`#sessions`) → Findings
(`#findings`, six topics) → Cite → Team → footer.

| Place | Eyebrow | Heading | Header link |
|---|---|---|---|
| Overview | Overview | The trace at a glance | Overview |
| The list | Sessions | Browse every session | Sessions |
| The topics | Findings | What the trace shows | Findings |
| Cite | Citation | Cite this data | Cite |

Topics keep their numbers: 01 Session structure, 02 Tokens and cost,
03 Latency, 04 Tools, 05 Prefix caching, 06 Human-driven against benchmark.
Anchors `#findings-sessions`, `-tokens`, `-latency`, `-tools`, `-caching`,
`-comparison`. The hero's primary button: "Explore the findings" →
`#findings`. The Session page's back link: "← Sessions".

Why the list before the findings: it is the one thing the site offers that
the paper cannot, and a visitor who opens a session reads the findings with
a concrete case in mind.

## 2. The finding line

A card: title, finding, legend, chart, caption, Definition. The finding is
one line, at most sixteen words, led by a number phrase in the strong
weight, then a plain clause:

> **Median turn 61 s, median session 30 min:** sessions are idle time between turns.

Rendering: `renderFigure` takes `finding` as `{ lead, rest }`; `.figure-finding`
is body size, the lead `font-weight: 600`, a 3 px accent rule on the left
as the eyebrow's mark, 0.5 rem under the title. On a phone it wraps; the
rule stays. The caption keeps its place under the chart and its twelve-word
budget; where a finding already says what the caption says, the caption
says what is drawn, not the result.

The topic takeaway: one sentence, at most twenty-five words, under the
topic heading in the muted colour at the lede size, `.topic-takeaway`.

## 3. Numbers are the site's, and tested

Each figure entry with a number in its finding names
`findingNumbers(answer) → string[]`: the numbers the text states, formatted
with the site's formatters from the shipped answer's rows (medians from the
CDF series at 0.5, shares from the share columns, ratios as the comparison
legend computes them). `tests/findings.test.js` loads every entry, reads its
answer under `site/data/all_weeks/figures/`, and asserts each returned
string appears in `lead + rest`. A finding states only numbers the answer
yields; everything else is said without a number.

The paper's numbers below are the draft. Where the site's answer differs
(its definitions are the archived changes': five models in the TTFT CDFs,
fixed bins, per-session means), the finding takes the site's number and
`docs/differences.md` says so in one line.

## 4. The findings

### 01 Session structure
Takeaway: A session is a few user prompts and tens of model and tool steps, with long idle gaps between the turns.

| Figure | Finding (lead — rest) |
|---|---|
| requests_per_session_cdf | **Median 4 user steps, 36 tool steps, 42 requests:** a few prompts drive tens of model requests. |
| duration_cdf | **Median turn 61 s, median session 30 min:** sessions are mostly idle time between turns. |
| subagents_per_session | **10% of sessions use subagents,** most of them spawning a single child. |
| user_prompt_tokens_by_scope | **Median prompt 42 tokens, benchmark 1.4K:** people write short, varied prompts. |

### 02 Tokens and cost
Takeaway: Requests reuse large, growing contexts while adding little new input or output, so cache reads dominate token volume and cost.

| Figure | Finding |
|---|---|
| tokens_per_request_cdf | **129K input tokens at the median, ~500 uncached, ~200 output:** requests add little to a large context. |
| token_split_by_week | **Cached input is 97% of tokens** in every week of the trace. |
| token_growth_by_messages | **Cached context grows past 100K tokens** while new input and output stay in the hundreds. |
| context_share_by_role | **Tool results peak in mid-length contexts;** assistant history dominates the longest. |
| cached_fraction_per_request | **Most requests reuse nearly all of their prefix;** the median cached share is 99.6%. |
| cost_share_by_session | **Cached input is 73% of API cost,** uncached 17%, output 10%, at list prices. |

### 03 Latency
Takeaway: Serving overheads shape time to first token, tool execution dominates active time, and user idle dominates the session.

| Figure | Finding |
|---|---|
| ttft_cdf_by_model | **Median TTFT about 4 s** where pure prefill would take under 0.1 s: overheads dominate. |
| decode_cdf_by_model | **Median decode 1–3 s:** outputs are a few hundred tokens. |
| session_time_by_part | **User idle 50%, tools 22%, decode 18%, prefill 10%** of session time. |
| speedup_if_twice_as_fast | **Tools twice as fast: 1.38×;** decode 1.16×, prefill 1.09×. |

### 04 Tools
Takeaway: Tool latency and result size differ by category; most calls are issued one at a time, though batching finishes them in nearly flat time.

| Figure | Finding |
|---|---|
| latency_by_category | **Read under 1 s at the median, Build/Test 7 s, Wait/Poll 12 s;** every category has a long tail. |
| result_tokens_by_category | **Read returns 441 tokens at the median** and a third of all result tokens from a sixth of calls. |
| calls_per_request_by_category | **84.5% of requests issue one call;** Subagent, Browser and Read are batched most. |
| latency_by_batch_width | **Batched calls finish in nearly flat time** as the batch grows; one by one grows linearly. |
| tool_mix_by_turn_position | **Benchmark turns go Read and Search, then Build/Test;** human turns mix tools throughout. |

### 05 Prefix caching
Takeaway: Reuse is high inside model and tool loops and breaks on user waits and context mutations; fifteen minutes of retention catches most of it.

| Figure | Finding |
|---|---|
| hit_ratio_cdf_by_gap_bin | **Reuse holds under a minute, 58% at 15–30 min, 18% past an hour.** |
| hit_ratio_by_idle_gap | **Providers keep prefixes from minutes to an hour:** retention is a hidden cost. |
| gap_cdf_by_cause | **Tool gaps: 1.8 s median. User idle: 17 min at P90.** |
| mean_hit_ratio_by_cause | **97.5% hit ratio after a tool gap, 84% after user idle.** |
| hit_ratio_cdf_by_transition | **After a mutation the hit ratio collapses;** after an append it stays near 1. |
| mutations_by_cause | **Mutations are 4% of steps, in 56% of sessions, 62% of new prefill.** |
| prefill_against_storage | **15 min leaves prefill 61% above the floor;** a day reaches 1% at 26× the storage. |
| api_cost_by_ttl | **API cost flattens at 30 min, 0.65× of a 1-minute TTL.** |
| infrastructure_cost_by_ttl | **Infrastructure cost bottoms at 15 min, 0.42×:** longer retention buys dead blocks. |

### 06 Human-driven against benchmark
Takeaway: Benchmark replays run shorter, carry smaller contexts and never idle, so they understate the retention a serving system needs.

| Figure | Finding |
|---|---|
| turn_duration_by_scope | **Benchmark turns 3.1× longer (188 s vs 61 s)** and never interrupted. |
| session_duration_by_scope | **Human sessions 9.4× longer (30 min vs 3.2 min):** turns with idle time between. |
| input_per_request_by_scope | **Human requests carry 5.1× the context (129K vs 25K tokens).** |
| user_prompt_tokens_by_scope | shown under 01; not repeated here |

## 5. Text budget
A card: title ≤ 5 words, finding ≤ 16, caption ≤ 12, definition ≤ 40.
A topic: heading, takeaway ≤ 25 words. The node test that counts caption
words counts the finding and the takeaway too.

## 6. Out of scope
New figures, new queries, the Session page's views, the Overview cards.

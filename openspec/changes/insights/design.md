# Design: insights

## 1. Order and names

Hero → Overview (`#overview`) → Sessions (`#sessions`) → Insights
(`#insights`, six topics) → Cite → Team → footer.

Four sections, four names, used as the heading and the header link alike,
with no eyebrow above them: **Overview**, **Session Explorer**,
**Insights**, **Cite**. The `.section-heading` frame keeps its heading
and drops its eyebrow line.

Topics keep their numbers: 01 Session structure, 02 Tokens and cost,
03 Latency, 04 Tools, 05 Prefix caching, 06 Human-driven against benchmark.
Anchors `#insights-sessions`, `-tokens`, `-latency`, `-tools`, `-caching`,
`-comparison`. The hero's primary button: "Insights" → `#insights`. The
Session page's back link: "← Sessions".

Why the list before the insights: it is the one thing the site offers that
the paper cannot, and a visitor who opens a session reads the insights with
a concrete case in mind.

## 2. The insight line

A card: title, insight, legend, chart, caption, Definition. The insight is
one sentence of at most twelve words, in the body weight with a 3 px
accent rule on its left (the eyebrow's mark), 0.5 rem under the title. It
says what the chart means; the caption under the chart keeps saying what
is drawn, within its twelve-word budget. Numbers are rare: one appears
only when the number is the point.

The topic takeaway: one sentence of at most twenty words under the topic
heading, in the muted colour at the lede size, `.topic-takeaway`.

No test checks a sentence against the data. The sentences are the paper's
claims, and the figure beside each one is the evidence; the word-count
test keeps them short and present.

## 3. The insights

### 01 Session structure
Takeaway: A session is a few prompts and tens of model and tool steps, with long idle gaps between turns.

| Figure | Insight |
|---|---|
| requests_per_session_cdf | A few prompts drive tens of model requests. |
| duration_cdf | Sessions are mostly idle time between turns. |
| subagents_per_session | Subagents are rare, and usually one at a time. |
| user_prompt_tokens_by_scope | People write short, varied prompts; the benchmark writes long ones. |

### 02 Tokens and cost
Takeaway: Requests reuse large, growing contexts while adding little, so cache reads dominate tokens and cost.

| Figure | Insight |
|---|---|
| tokens_per_request_cdf | Each request adds little to a large context. |
| token_split_by_week | Cached input is almost all of the tokens, every week. |
| token_growth_by_messages | The cached prefix grows all session; new tokens stay small. |
| context_share_by_role | Tool results fill mid-session contexts; assistant history fills the longest. |
| cached_fraction_per_request | Most requests reuse nearly all of their prefix. |
| cost_share_by_session | Cache reads are most of the API bill. |

### 03 Latency
Takeaway: Serving overheads shape time to first token, tools dominate active time, and user idle dominates the session.

| Figure | Insight |
|---|---|
| ttft_cdf_by_model | Time to first token is overhead, not prefill. |
| decode_cdf_by_model | Decode is short because outputs are short. |
| session_time_by_part | Half of a session is the user thinking; tools take most of the rest. |
| speedup_if_twice_as_fast | Faster tools buy more than faster prefill or decode. |

### 04 Tools
Takeaway: Tool latency and result size differ by category; most calls go one at a time, though batching keeps latency flat.

| Figure | Insight |
|---|---|
| latency_by_category | Local tools are fast; builds and waits are slow, with long tails. |
| result_tokens_by_category | Reads return the most tokens and drive context growth. |
| calls_per_request_by_category | Most requests issue one call; reads and subagents get batched. |
| latency_by_batch_width | Batching keeps latency flat as the batch grows. |
| tool_mix_by_turn_position | Benchmark turns explore, then build; human turns mix tools throughout. |

### 05 Prefix caching
Takeaway: Reuse is high inside model and tool loops and breaks on user waits and context mutations.

| Figure | Insight |
|---|---|
| hit_ratio_cdf_by_gap_bin | Reuse survives a minute and fades by an hour. |
| hit_ratio_by_idle_gap | Providers retain prefixes from minutes to an hour, invisibly. |
| gap_cdf_by_cause | Tool gaps last seconds; user idle lasts minutes. |
| mean_hit_ratio_by_cause | Misses follow user waits, not tool loops. |
| hit_ratio_cdf_by_transition | A context mutation throws the prefix away. |
| mutations_by_cause | Mutations are rare per step, common per session, costly. |
| prefill_against_storage | Fifteen minutes of retention catches most reuse; a day costs far more storage. |
| api_cost_by_ttl | API cost flattens after thirty minutes of retention. |
| infrastructure_cost_by_ttl | Infrastructure cost bottoms at fifteen minutes. |

### 06 Human-driven against benchmark
Takeaway: Benchmark replays run shorter, carry smaller contexts and never idle, so they understate what serving needs.

| Figure | Insight |
|---|---|
| turn_duration_by_scope | Benchmark turns run longer and never pause. |
| session_duration_by_scope | Human sessions last far longer, in turns with idle time between. |
| input_per_request_by_scope | Human requests carry far larger contexts. |

## 4. Text budget
A card: title ≤ 5 words, insight ≤ 12, caption ≤ 12, definition ≤ 40.
A topic: heading, takeaway ≤ 20 words.

## 5. Out of scope
New figures, new queries, the Session page's views, the Overview cards.

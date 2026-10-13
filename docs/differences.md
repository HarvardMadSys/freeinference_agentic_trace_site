# Where the site draws more simply than the paper

Each figure's Definition on the Explore page says what the site draws; this
is every place where that differs from the paper. `tests/test_differences.py`
checks that no figure's definition names the paper, and that the numbers
below are the queries' and the pipeline's.

- **Every figure**: a bin with fewer than 50 rows is hidden, and the figure
  says how many were; the paper also drops thin size bins, but merges an
  idle-gap bin of fewer than 20 requests into the next one.
- **Token growth with the context**: fixed power-of-two bins of the messages
  in a request, where the paper fits its bins to the data.
- **Context share by role**: each role's share of the input pooled per
  power-of-two bin of input tokens, tool definitions included, where the paper
  takes each request's share per bin of messages and its main figure leaves
  tool definitions out.
- **Token split by week**: plain token shares per week, where the paper
  weights tokens by price and ranks sessions; **Cost breakdown by session** does
  that, as the paper does, at the pipeline's prices: cached, uncached and
  output at 1 : 10 : 50.
- **Time to first token by model** and **Decode time by model**: the five
  models with most requests that are among the eight with most requests over
  every week, where the paper draws two fixed models, each with its decode
  time and an estimate of its queueing time; the site draws no queueing
  estimate.
- **Tool latency by category** and **Tool result size by category**:
  percentiles per category, where the paper also marks the mean.
- **Cache reuse by wait type**: each bar from 0%, where the paper starts its
  bars at 70% so that their differences show.
- **Cache reuse by provider**: the pipeline's fixed idle-gap bins, each
  drawn at its middle, a line for each of the eight providers with most
  requests, where the paper merges a thin bin into the next, draws each bin at
  its requests' median gap and shows the four providers with most idle gaps.

As in the paper, the hit ratio after a context change leaves out a switch to
another model or provider: it is routing, not a change of context.

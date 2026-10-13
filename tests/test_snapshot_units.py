"""The snapshot test's normalising of what it reads: markup one element per line with Plot's numbered ids unnumbered,
whitespace collapsed, and a card's title made a file name; and its list of states."""

import snapshot_units


def test_markup_is_written_one_element_per_line() -> None:
    html = '<svg class="plot-d6a7b5"><g><text>12\n  weeks</text></g></svg>'
    assert snapshot_units.markup_lines(html) == '<svg class="plot-d6a7b5">\n<g>\n<text>12 weeks</text>\n</g>\n</svg>'


def test_whitespace_between_elements_still_splits_them() -> None:
    html = '<g>\n  <line x1="0">  </line>\n</g>'
    assert snapshot_units.markup_lines(html) == '<g>\n<line x1="0">\n</line>\n</g>'


def test_plot_clip_ids_are_unnumbered() -> None:
    html = '<clipPath id="plot-clip-7"></clipPath><g clip-path="url(#plot-clip-12)"></g>'
    expected = '<clipPath id="plot-clip">\n</clipPath>\n<g clip-path="url(#plot-clip)">\n</g>'
    assert snapshot_units.markup_lines(html) == expected


def test_plot_marker_and_pattern_ids_are_unnumbered() -> None:
    html = '<marker id="plot-marker-3"></marker><pattern id="plot-pattern-14"></pattern>'
    expected = '<marker id="plot-marker">\n</marker>\n<pattern id="plot-pattern">\n</pattern>'
    assert snapshot_units.markup_lines(html) == expected


def test_a_word_that_ends_in_plot_is_left_as_it_is() -> None:
    assert snapshot_units.markup_lines('<g class="subplot-clip-2"></g>') == '<g class="subplot-clip-2">\n</g>'


def test_plain_text_collapses_whitespace() -> None:
    assert snapshot_units.plain_text("  97.8%\n 13.9M\tcached ") == "97.8% 13.9M cached"


def test_a_card_title_is_a_file_name() -> None:
    assert snapshot_units.unit_name("Human-driven against benchmark: TTFT (s)") == "human_driven_against_benchmark_ttft_s"


def test_every_session_is_read_in_every_view() -> None:
    names = snapshot_units.state_names()
    assert len(names) == len(snapshot_units.EXPLORE_STATES) + len(snapshot_units.SESSIONS) * len(snapshot_units.VIEWS)
    assert "session-with-subagents-timeline" in names

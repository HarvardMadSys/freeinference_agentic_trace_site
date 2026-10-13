"""The snapshot test's normalising of what it reads: markup one element per line with Plot's clip ids unnumbered,
whitespace collapsed, and a card's title made a file name."""

import snapshot_units


def test_markup_is_written_one_element_per_line() -> None:
    html = '<svg class="plot-d6a7b5"><g><text>12\n  weeks</text></g></svg>'
    assert snapshot_units.markup_lines(html) == '<svg class="plot-d6a7b5">\n<g>\n<text>12 weeks</text>\n</g>\n</svg>'


def test_plot_clip_ids_are_unnumbered() -> None:
    html = '<clipPath id="plot-clip-7"></clipPath><g clip-path="url(#plot-clip-12)"></g>'
    expected = '<clipPath id="plot-clip">\n</clipPath>\n<g clip-path="url(#plot-clip)">\n</g>'
    assert snapshot_units.markup_lines(html) == expected


def test_plain_text_collapses_whitespace() -> None:
    assert snapshot_units.plain_text("  97.8%\n 13.9M\tcached ") == "97.8% 13.9M cached"


def test_a_card_title_is_a_file_name() -> None:
    assert snapshot_units.unit_name("Human-driven against benchmark: TTFT (s)") == "human_driven_against_benchmark_ttft_s"

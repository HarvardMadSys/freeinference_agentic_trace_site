"""Every row of the loaded release carries the week folder it was read from; integer columns keep their nulls."""

import pathlib

import numpy
import pandas
from release import schema

from site_data import loading, weeks

import fixture_release


def test_every_row_carries_the_sunday_of_its_week_folder(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries)
    assert isinstance(release, loading.WeekTaggedRelease)
    assert release.sessions.week.value_counts().to_dict() == {"2026-05-31": 6, "2026-06-07": 2}
    assert release.requests.week.value_counts().to_dict() == {"2026-05-31": 15, "2026-06-07": 5}
    assert release.tool_calls.week.value_counts().to_dict() == {"2026-05-31": 14, "2026-06-07": 2}


def test_only_the_listed_weeks_are_loaded(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries[1:])
    assert sorted(release.sessions.session_id) == ["idle-week-2", "mutation"]


def test_struct_fields_are_named_as_the_reader_flattens_them() -> None:
    names = loading.integer_columns(schema.REQUESTS_SCHEMA)
    assert "role_tokens.system" in names and "ttft_ms" in names and "step" in names
    assert "role_tokens" not in names and "model" not in names


def test_an_integer_column_read_as_float_gets_its_integer_type_back() -> None:
    frame = pandas.DataFrame({"ttft_ms": [1_000.0, numpy.nan], "prompt_tokens": [10, 20], "hit_ratio": [0.5, numpy.nan]})
    restored = loading.with_nullable_integers(frame, schema.REQUESTS_SCHEMA)
    assert restored.ttft_ms.dtype == "Int64" and restored.ttft_ms.isna().tolist() == [False, True]
    assert restored.prompt_tokens.dtype == "int64"  # no nulls, so it arrived as an integer
    assert restored.hit_ratio.dtype == "float64"  # not a column of the release

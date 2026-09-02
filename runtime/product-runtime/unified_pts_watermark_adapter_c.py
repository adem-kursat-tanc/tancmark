from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from fractions import Fraction
from pathlib import Path
from typing import Any

import av
import numpy as np


CANDIDATE_NAME = "UNIFIED_PTS_WATERMARK_ADAPTER_C"


def _fraction_text(value: Any) -> str | None:
    if value is None:
        return None
    rational = Fraction(value)
    return f"{rational.numerator}/{rational.denominator}"


def _rotation_from_ffprobe(source: Path, ffprobe: str) -> int:
    proc = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream_tags=rotate:stream_side_data=rotation",
            "-of",
            "json",
            str(source),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"FFPROBE_ROTATION_FAILED:{proc.stderr[-1000:]}")
    payload = json.loads(proc.stdout)
    stream = (payload.get("streams") or [{}])[0]
    for side_data in stream.get("side_data_list") or []:
        if side_data.get("rotation") is not None:
            return int(round(float(side_data["rotation"])))
    rotate_tag = (stream.get("tags") or {}).get("rotate")
    return int(round(float(rotate_tag))) if rotate_tag is not None else 0


def _load_replacements(path: Path) -> dict[int, Path]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("replacements") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("REPLACEMENT_MANIFEST_ROWS_REQUIRED")
    replacements: dict[int, Path] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("REPLACEMENT_ROW_OBJECT_REQUIRED")
        frame_idx = int(row["frameIdx"])
        png_path = Path(row["pngPath"]).resolve(strict=True)
        if frame_idx < 0:
            raise ValueError("NEGATIVE_REPLACEMENT_FRAME_INDEX")
        if frame_idx in replacements:
            raise ValueError(f"DUPLICATE_REPLACEMENT_FRAME_INDEX:{frame_idx}")
        replacements[frame_idx] = png_path
    return replacements


def _decode_png_rgb24(path: Path) -> np.ndarray:
    with av.open(str(path), mode="r") as container:
        frame = next(container.decode(video=0), None)
        if frame is None:
            raise RuntimeError(f"PNG_DECODE_FAILED:{path.name}")
        return np.ascontiguousarray(frame.to_ndarray(format="rgb24"))


def _profile(name: str) -> dict[str, Any]:
    profiles = {
        "mov_h264_lab": {
            "container": "mov",
            "codec": "libx264",
            "pix_fmt": "yuv420p",
            "options": {"crf": "18", "preset": "medium"},
            "classification": "LAB_ONLY_EXISTING_PYAV_WHEEL_LIBX264",
        },
        "mp4_h264_lab": {
            "container": "mp4",
            "codec": "libx264",
            "pix_fmt": "yuv420p",
            "options": {"crf": "18", "preset": "medium"},
            "classification": "LAB_ONLY_EXISTING_PYAV_WHEEL_LIBX264",
        },
        "nut_ffv1_lab": {
            "container": "nut",
            "codec": "ffv1",
            "pix_fmt": "yuv420p",
            "options": {},
            "classification": "LAB_FEASIBILITY_PRODUCT_LICENSE_NOT_YET_PROVEN",
        },
        "mkv_ffv1_fallback_lab": {
            "container": "matroska",
            "codec": "ffv1",
            "pix_fmt": "yuv420p",
            "options": {},
            "classification": "FALLBACK_LAB_FEASIBILITY",
        },
        "mkv_ffv1_codespaces_demo": {
            "container": "matroska",
            "codec": "ffv1",
            "pix_fmt": "yuv420p",
            "options": {"level": "3"},
            "classification": "CODESPACES_LINUX_DEMO_PROFILE_V1",
        },
    }
    if name not in profiles:
        raise ValueError(f"UNSUPPORTED_PROFILE:{name}")
    return profiles[name]


def run(args: argparse.Namespace) -> dict[str, Any]:
    source = Path(args.source).resolve(strict=True)
    output = Path(args.output).resolve(strict=False)
    manifest = Path(args.replacements_json).resolve(strict=True)
    if output.exists():
        raise FileExistsError(f"OUTPUT_MUST_NOT_EXIST:{output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    replacements = _load_replacements(manifest)
    profile = _profile(args.profile)
    rotation = _rotation_from_ffprobe(source, args.ffprobe)
    started = time.perf_counter()
    frame_count = 0
    encoded_packet_count = 0
    copied_packet_count = 0
    replacement_count = 0
    source_container = av.open(str(source), mode="r")
    source_chapters = source_container.chapters()
    if len(source_chapters) > 0:
        source_container.close()
        raise RuntimeError("UNSUPPORTED_STREAM_PRESERVATION:CHAPTERS")
    video_in = next(
        (stream for stream in source_container.streams if stream.type == "video"),
        None,
    )
    if video_in is None:
        source_container.close()
        raise RuntimeError("SOURCE_VIDEO_STREAM_REQUIRED")
    source_time_base = video_in.time_base
    if source_time_base is None:
        source_container.close()
        raise RuntimeError("SOURCE_VIDEO_TIME_BASE_REQUIRED")
    output_width = video_in.codec_context.width
    output_height = video_in.codec_context.height
    normalize_rotation = abs(rotation) % 180 == 90
    if normalize_rotation:
        output_width, output_height = output_height, output_width
    container_options: dict[str, str] = {}
    if profile["container"] in {"mov", "mp4"}:
        container_options["video_track_timescale"] = str(source_time_base.denominator)
        container_options["movie_timescale"] = str(source_time_base.denominator)
        container_options["movflags"] = "+use_metadata_tags"
    target = av.open(
        str(output),
        mode="w",
        format=profile["container"],
        options=container_options,
    )
    target.metadata.update(source_container.metadata)
    try:
        video_out = target.add_stream(profile["codec"], rate=video_in.average_rate)
        video_out.width = output_width
        video_out.height = output_height
        video_out.pix_fmt = profile["pix_fmt"]
        video_out.options = profile["options"]
        video_out.time_base = source_time_base
        video_out.codec_context.time_base = source_time_base
        video_out.metadata.update(
            {key: value for key, value in video_in.metadata.items() if key != "rotate"}
        )
        stream_map = {video_in.index: video_out}
        for stream in source_container.streams:
            if stream.index == video_in.index:
                continue
            try:
                copied = target.add_stream_from_template(stream, opaque=True)
            except Exception as exc:
                raise RuntimeError(
                    f"UNSUPPORTED_STREAM_PRESERVATION:{stream.type}:{stream.index}:{exc}"
                ) from exc
            copied.metadata.update(stream.metadata)
            stream_map[stream.index] = copied

        for packet in source_container.demux():
            if packet.stream.index == video_in.index:
                for frame in packet.decode():
                    original_pts = frame.pts
                    original_time_base = frame.time_base
                    original_duration = frame.duration
                    if original_pts is None or original_time_base is None:
                        raise RuntimeError(f"FRAME_TIMESTAMP_REQUIRED:{frame_count}")
                    replacement = replacements.get(frame_count)
                    if replacement is not None:
                        array = _decode_png_rgb24(replacement)
                        replacement_count += 1
                    else:
                        array = frame.to_ndarray(format="rgb24")
                        if normalize_rotation:
                            array = np.rot90(array, k=3 if rotation < 0 else 1)
                        array = np.ascontiguousarray(array)
                    if array.shape[1] != output_width or array.shape[0] != output_height:
                        raise RuntimeError(
                            "FRAME_GEOMETRY_MISMATCH:"
                            f"{frame_count}:{array.shape[1]}x{array.shape[0]}:"
                            f"expected={output_width}x{output_height}"
                        )
                    encoded_frame = av.VideoFrame.from_ndarray(array, format="rgb24")
                    encoded_frame = encoded_frame.reformat(
                        width=output_width,
                        height=output_height,
                        format=profile["pix_fmt"],
                    )
                    encoded_frame.pts = original_pts
                    encoded_frame.time_base = original_time_base
                    if original_duration is not None:
                        encoded_frame.duration = original_duration
                    for out_packet in video_out.encode(encoded_frame):
                        target.mux(out_packet)
                        encoded_packet_count += 1
                    frame_count += 1
            else:
                if packet.dts is None and packet.pts is None:
                    continue
                packet.stream = stream_map[packet.stream.index]
                target.mux(packet)
                copied_packet_count += 1
        for out_packet in video_out.encode(None):
            target.mux(out_packet)
            encoded_packet_count += 1
    finally:
        target.close()
        source_container.close()

    missing = sorted(set(replacements) - set(range(frame_count)))
    if missing:
        raise RuntimeError(f"REPLACEMENT_FRAME_NOT_FOUND:{missing[:20]}")
    return {
        "schemaVersion": "tancmark-unified-pts-watermark-adapter-c-run-v1",
        "candidate": CANDIDATE_NAME,
        "status": "ADAPTER_C_WRITEBACK_COMPLETED",
        "profile": args.profile,
        "container": profile["container"],
        "codec": profile["codec"],
        "runtimeClassification": profile["classification"],
        "pyavVersion": av.__version__,
        "frameCount": frame_count,
        "encodedVideoPackets": encoded_packet_count,
        "copiedNonVideoPackets": copied_packet_count,
        "requestedReplacementFrames": len(replacements),
        "appliedReplacementFrames": replacement_count,
        "oneInputOneOutputFrame": frame_count > 0,
        "sourceVideoTimeBase": _fraction_text(source_time_base),
        "containerOptions": container_options,
        "rotationInputDegrees": rotation,
        "rotationPolicy": (
            "NORMALIZE_TO_UPRIGHT_AND_CLEAR_ROTATION"
            if normalize_rotation
            else "PRESERVE_RASTER_ORIENTATION"
        ),
        "audioPolicy": "PACKET_TIMESTAMP_PRESERVING_STREAM_COPY",
        "silenceAdded": False,
        "audioTrimmed": False,
        "fixedFpsTimelineGenerated": False,
        "wallMs": round((time.perf_counter() - started) * 1000, 3),
        "outputBytes": output.stat().st_size,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--replacements-json", required=True)
    parser.add_argument("--result-json", required=True)
    parser.add_argument(
        "--profile",
        default="mov_h264_lab",
        choices=[
            "mov_h264_lab",
            "mp4_h264_lab",
            "nut_ffv1_lab",
            "mkv_ffv1_fallback_lab",
            "mkv_ffv1_codespaces_demo",
        ],
    )
    parser.add_argument("--ffprobe", default=os.environ.get("FFPROBE", "ffprobe"))
    args = parser.parse_args()
    result_path = Path(args.result_json).resolve(strict=False)
    result_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = run(args)
        exit_code = 0
    except Exception as exc:
        result = {
            "schemaVersion": "tancmark-unified-pts-watermark-adapter-c-run-v1",
            "candidate": CANDIDATE_NAME,
            "status": "ADAPTER_C_WRITEBACK_FAILED",
            "errorType": type(exc).__name__,
            "error": str(exc),
        }
        exit_code = 1
    result_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, separators=(",", ":")), flush=True)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())

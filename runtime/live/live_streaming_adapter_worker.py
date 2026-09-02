from __future__ import annotations

import argparse
import ctypes
import importlib.util
import json
import os
import struct
import sys
import time
from fractions import Fraction
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import av
import numpy as np


SCHEMA = "tancmark-live-streaming-adapter-worker-v1"


def _process_metrics() -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "processCpuSeconds": round(time.process_time(), 6),
        "workingSetBytes": None,
        "peakWorkingSetBytes": None,
    }
    if os.name != "nt":
        return metrics
    try:
        class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]
        counters = PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(counters)
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        if ctypes.windll.psapi.GetProcessMemoryInfo(
            handle,
            ctypes.byref(counters),
            counters.cb,
        ):
            metrics["workingSetBytes"] = int(counters.WorkingSetSize)
            metrics["peakWorkingSetBytes"] = int(counters.PeakWorkingSetSize)
    except (AttributeError, OSError, ValueError):
        pass
    return metrics


def _safe_child(root: Path, value: str, *, must_exist: bool) -> Path:
    candidate = Path(value).resolve(strict=must_exist)
    root = root.resolve(strict=True)
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise RuntimeError("LIVE_WORKER_PATH_OUTSIDE_JOB_ROOT") from exc
    current = candidate if must_exist else candidate.parent
    while current != root:
        if current.is_symlink():
            raise RuntimeError("LIVE_WORKER_REPARSE_REJECTED")
        current = current.parent
    return candidate


def _write_png_array(path: Path, rgb_array: np.ndarray[Any, Any]) -> None:
    output = av.open(str(path), mode="w", format="image2")
    try:
        stream = output.add_stream("png", rate=1)
        stream.width = int(rgb_array.shape[1])
        stream.height = int(rgb_array.shape[0])
        stream.pix_fmt = "rgb24"
        rgb = av.VideoFrame.from_ndarray(
            np.ascontiguousarray(rgb_array),
            format="rgb24",
        )
        for packet in stream.encode(rgb):
            output.mux(packet)
        for packet in stream.encode(None):
            output.mux(packet)
    finally:
        output.close()


def _selection_score(rgb: np.ndarray[Any, Any]) -> float:
    height = int(rgb.shape[0])
    width = int(rgb.shape[1])
    center_x = width // 2
    center_y = height // 2
    anchors = (
        (center_x - 76, center_y - 76),
        (center_x + 44, center_y - 76),
        (center_x - 76, center_y + 44),
        (center_x + 44, center_y + 44),
    )
    anchor_stds: list[float] = []
    for x, y in anchors:
        x0, x1 = max(0, x - 16), min(width, x + 16)
        y0, y1 = max(0, y - 16), min(height, y + 16)
        patch = rgb[y0:y1, x0:x1].astype(np.float64, copy=False)
        if patch.size == 0:
            anchor_stds.append(0.0)
            continue
        luma = 0.299 * patch[:, :, 0] + 0.587 * patch[:, :, 1] + 0.114 * patch[:, :, 2]
        anchor_stds.append(float(np.std(luma)))
    sampled = rgb[::8, ::8].astype(np.float64, copy=False)
    sampled_luma = 0.299 * sampled[:, :, 0] + 0.587 * sampled[:, :, 1] + 0.114 * sampled[:, :, 2]
    mean_y = float(np.mean(sampled_luma)) if sampled_luma.size else 0.0
    substrate = min(anchor_stds)
    brightness = 10.0 if 32.0 <= mean_y <= 224.0 else 0.0
    return min(30.0, substrate) * 100.0 + brightness


def _prepare(command: dict[str, Any]) -> dict[str, Any]:
    try:
        job_root = Path(str(command["jobRoot"])).resolve(strict=True)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_JOB_ROOT_FILE_NOT_FOUND") from exc
    try:
        source = _safe_child(job_root, str(command["source"]), must_exist=True)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_SOURCE_PATH_FILE_NOT_FOUND") from exc
    try:
        frames_dir = _safe_child(job_root, str(command["framesDir"]), must_exist=False)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_FRAMES_PATH_FILE_NOT_FOUND") from exc
    try:
        frames_dir.mkdir(parents=True, exist_ok=False)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_FRAMES_DIR_FILE_NOT_FOUND") from exc
    started = time.perf_counter()
    try:
        container = av.open(str(source), mode="r")
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_SOURCE_OPEN_FILE_NOT_FOUND") from exc
    try:
        video = next((stream for stream in container.streams if stream.type == "video"), None)
        if video is None or video.time_base is None:
            raise RuntimeError("LIVE_WORKER_VIDEO_TIMELINE_REQUIRED")
        frames: list[dict[str, Any]] = []
        candidates: list[tuple[float, int, np.ndarray[Any, Any]]] = []
        try:
            for index, frame in enumerate(container.decode(video=video.index)):
                if frame.pts is None or frame.time_base is None:
                    raise RuntimeError("LIVE_WORKER_FRAME_TIMESTAMP_REQUIRED")
                rgb = np.ascontiguousarray(frame.to_ndarray(format="rgb24"))
                selection_score = _selection_score(rgb)
                frames.append(
                    {
                        "frameIdx": index,
                        "pts": str(frame.pts),
                        "timeBase": f"{frame.time_base.numerator}/{frame.time_base.denominator}",
                        "duration": None if frame.duration is None else int(frame.duration),
                        "selectionScore": round(selection_score, 6),
                        "pngPath": None,
                    }
                )
                candidates.append((selection_score, index, rgb))
                candidates.sort(key=lambda row: (-row[0], row[1]))
                if len(candidates) > 4:
                    candidates.pop()
        except FileNotFoundError as exc:
            raise RuntimeError("LIVE_WORKER_VIDEO_DECODE_FILE_NOT_FOUND") from exc
        if not frames:
            raise RuntimeError("LIVE_WORKER_DECODED_FRAME_REQUIRED")
        for _score, index, rgb in candidates:
            png = frames_dir / f"frame_{index:06d}.png"
            try:
                _write_png_array(png, rgb)
            except FileNotFoundError as exc:
                raise RuntimeError("LIVE_WORKER_PNG_WRITE_FILE_NOT_FOUND") from exc
            frames[index]["pngPath"] = str(png)
        return {
            "status": "FRAMES_READY",
            "frameCount": len(frames),
            "width": int(video.codec_context.width),
            "height": int(video.codec_context.height),
            "videoTimeBase": f"{video.time_base.numerator}/{video.time_base.denominator}",
            "frames": frames,
            "candidateCount": len(candidates),
            "wallMs": round((time.perf_counter() - started) * 1000, 3),
            "processMetrics": _process_metrics(),
        }
    finally:
        try:
            container.close()
        except FileNotFoundError as exc:
            raise RuntimeError("LIVE_WORKER_SOURCE_CLOSE_FILE_NOT_FOUND") from exc


def _prepare_exact_frame(command: dict[str, Any]) -> dict[str, Any]:
    """Decode only the already-addressed frame used by periodic verification.

    Placement still uses the full `_prepare` suitability scan.  This bounded
    path is deliberately verification-only: the authoritative Channel A
    ordinal is already signed into the rolling map, so rescoring every frame
    and writing four candidate PNGs would add CPU load without adding evidence.
    """
    try:
        job_root = Path(str(command["jobRoot"])).resolve(strict=True)
        source = _safe_child(job_root, str(command["source"]), must_exist=True)
        frames_dir = _safe_child(job_root, str(command["framesDir"]), must_exist=False)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_EXACT_FRAME_PATH_FILE_NOT_FOUND") from exc
    raw_frame_idxs = command.get("frameIdxs")
    if (
        not isinstance(raw_frame_idxs, list)
        or not 1 <= len(raw_frame_idxs) <= 4
        or any(isinstance(value, bool) or not isinstance(value, int) or value < 0 or value > 100_000 for value in raw_frame_idxs)
        or len(set(raw_frame_idxs)) != len(raw_frame_idxs)
    ):
        raise RuntimeError("LIVE_WORKER_EXACT_FRAME_INDEX_INVALID")
    frame_idxs = sorted(raw_frame_idxs)
    frame_idx_set = set(frame_idxs)
    frames_dir.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    container = av.open(str(source), mode="r")
    try:
        video = next((stream for stream in container.streams if stream.type == "video"), None)
        if video is None or video.time_base is None:
            raise RuntimeError("LIVE_WORKER_VIDEO_TIMELINE_REQUIRED")
        selected: list[dict[str, Any]] = []
        decoded_through = 0
        for index, frame in enumerate(container.decode(video=video.index)):
            decoded_through = index + 1
            if index not in frame_idx_set:
                continue
            if frame.pts is None or frame.time_base is None:
                raise RuntimeError("LIVE_WORKER_FRAME_TIMESTAMP_REQUIRED")
            png = frames_dir / f"frame_{index:06d}.png"
            _write_png_array(png, np.ascontiguousarray(frame.to_ndarray(format="rgb24")))
            selected.append({
                "frameIdx": index,
                "pts": str(frame.pts),
                "timeBase": f"{frame.time_base.numerator}/{frame.time_base.denominator}",
                "duration": None if frame.duration is None else int(frame.duration),
                "pngPath": str(png),
            })
            if len(selected) == len(frame_idxs):
                break
        if len(selected) != len(frame_idxs):
            raise RuntimeError("LIVE_WORKER_EXACT_FRAME_NOT_FOUND")
        return {
            "status": "EXACT_FRAMES_READY",
            "frames": selected,
            "decodedThroughCount": decoded_through,
            "wallMs": round((time.perf_counter() - started) * 1000, 3),
            "processMetrics": _process_metrics(),
        }
    finally:
        container.close()


def _load_adapter(path: Path):
    spec = importlib.util.spec_from_file_location("tancmark_adapter_c_frozen", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("LIVE_WORKER_ADAPTER_C_LOAD_FAILED")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _product_profile(name: str) -> dict[str, Any]:
    if name != "mp4_h264_mf_product":
        raise ValueError(f"UNSUPPORTED_PROFILE:{name}")
    return {
        "container": "mp4",
        "codec": "h264_mf",
        "pix_fmt": "yuv420p",
        "options": {
            "rate_control": "quality",
            "quality": "90",
            "scenario": "archive",
            "hardware_encoding": "0",
        },
        "classification": "PRODUCT_FIXED_FFMPEG_8_1_2_MEDIA_FOUNDATION",
    }


def _remux_fragmented(video_source_path: Path, original_source_path: Path, output_path: Path) -> None:
    video_source = av.open(str(video_source_path), mode="r")
    original_source = av.open(str(original_source_path), mode="r")
    target = av.open(
        str(output_path),
        mode="w",
        format="mp4",
        options={
            # One input CMAF fragment must produce one output moof.  Using
            # frag_keyframe can split a longer source part at encoder-inserted
            # keyframes, which breaks the atomic fragment/receipt boundary.
            # empty_moov keeps fragmented MP4 output and close() emits the one
            # bounded fragment for this per-request remux.
            "movflags": "+empty_moov+default_base_moof+omit_tfhd_offset",
            "frag_duration": "60000000",
        },
    )
    try:
        stream_map: dict[int, av.stream.Stream] = {}
        video_in = next((stream for stream in video_source.streams if stream.type == "video"), None)
        original_video = next((stream for stream in original_source.streams if stream.type == "video"), None)
        if video_in is None or original_video is None:
            raise RuntimeError("LIVE_WORKER_REMUX_VIDEO_REQUIRED")
        for original_stream in original_source.streams:
            template = video_in if original_stream.type == "video" else original_stream
            copied = target.add_stream_from_template(template, opaque=True)
            copied.metadata.update(template.metadata)
            if template.time_base is not None:
                copied.time_base = template.time_base
            stream_map[original_stream.index] = copied
        packets: list[tuple[Fraction, int, Fraction, av.packet.Packet]] = []
        for packet in video_source.demux(video=video_in.index):
            timestamp = packet.dts if packet.dts is not None else packet.pts
            time_base = packet.time_base or video_in.time_base
            if timestamp is None or time_base is None:
                continue
            packets.append((Fraction(timestamp) * Fraction(time_base), original_video.index, Fraction(time_base), packet))
        for original_stream in original_source.streams:
            if original_stream.type == "video":
                continue
            for packet in original_source.demux(original_stream):
                timestamp = packet.dts if packet.dts is not None else packet.pts
                time_base = packet.time_base or original_stream.time_base
                if timestamp is None or time_base is None:
                    continue
                packets.append((Fraction(timestamp) * Fraction(time_base), original_stream.index, Fraction(time_base), packet))
        if not packets or len(packets) > 100_000:
            raise RuntimeError("LIVE_WORKER_REMUX_PACKET_BOUND_INVALID")
        packets.sort(key=lambda row: (row[0], row[1]))
        for _timeline, stream_index, packet_time_base, packet in packets:
            packet.stream = stream_map[stream_index]
            packet.time_base = packet_time_base
            target.mux(packet)
    finally:
        target.close()
        original_source.close()
        video_source.close()


def _boxes(data: bytes) -> list[tuple[int, int, str]]:
    result: list[tuple[int, int, str]] = []
    offset = 0
    while offset < len(data):
        if offset + 8 > len(data):
            raise RuntimeError("LIVE_WORKER_MP4_BOX_TRUNCATED")
        size = struct.unpack_from(">I", data, offset)[0]
        kind = data[offset + 4 : offset + 8].decode("latin1")
        header = 8
        if size == 1:
            if offset + 16 > len(data):
                raise RuntimeError("LIVE_WORKER_MP4_BOX_TRUNCATED")
            size = struct.unpack_from(">Q", data, offset + 8)[0]
            header = 16
        elif size == 0:
            size = len(data) - offset
        if size < header or offset + size > len(data):
            raise RuntimeError("LIVE_WORKER_MP4_BOX_BOUNDS_INVALID")
        result.append((offset, offset + size, kind))
        offset += size
    return result


def _split_fragmented(path: Path, init_path: Path, fragment_path: Path) -> dict[str, Any]:
    data = path.read_bytes()
    boxes = _boxes(data)
    moofs = [row for row in boxes if row[2] == "moof"]
    if len(moofs) != 1:
        raise RuntimeError("LIVE_WORKER_SINGLE_MOOF_REQUIRED")
    moof_index = boxes.index(moofs[0])
    if moof_index + 1 >= len(boxes) or boxes[moof_index + 1][2] != "mdat":
        raise RuntimeError("LIVE_WORKER_MOOF_MDAT_REQUIRED")
    init_boxes = [row for row in boxes[:moof_index] if row[2] in {"ftyp", "moov", "free", "skip"}]
    if not any(row[2] == "ftyp" for row in init_boxes) or not any(row[2] == "moov" for row in init_boxes):
        raise RuntimeError("LIVE_WORKER_INIT_REQUIRED")
    # Keep only the segment type prefix. sidx/prft timestamps describe the
    # worker-local file and would become stale after the Node boundary restores
    # the authoritative source tfdt values.
    prefix = [row for row in boxes[:moof_index] if row[2] == "styp"]
    media_rows = prefix + [boxes[moof_index], boxes[moof_index + 1]]
    init_bytes = b"".join(data[start:end] for start, end, _kind in init_boxes)
    fragment_bytes = b"".join(data[start:end] for start, end, _kind in media_rows)
    init_path.write_bytes(init_bytes)
    fragment_path.write_bytes(fragment_bytes)
    return {
        "initBytes": len(init_bytes),
        "fragmentBytes": len(fragment_bytes),
        "topLevelBoxes": [kind for _start, _end, kind in boxes],
    }


def _codec_configuration(path: Path) -> tuple[tuple[Any, ...], ...]:
    container = av.open(str(path), mode="r")
    try:
        rows: list[tuple[Any, ...]] = []
        for stream in container.streams:
            context = stream.codec_context
            layout_name = None
            layout = getattr(context, "layout", None)
            if stream.type == "audio" and layout is not None:
                layout_name = getattr(layout, "name", None)
            rows.append(
                (
                    int(stream.index),
                    str(stream.type),
                    str(getattr(context, "name", "")),
                    None if stream.time_base is None else f"{stream.time_base.numerator}/{stream.time_base.denominator}",
                    bytes(getattr(context, "extradata", None) or b""),
                    int(getattr(context, "width", 0) or 0),
                    int(getattr(context, "height", 0) or 0),
                    int(getattr(context, "sample_rate", 0) or 0),
                    layout_name,
                )
            )
        return tuple(rows)
    finally:
        container.close()


def _write(command: dict[str, Any], adapter: Any, state: dict[str, Any]) -> dict[str, Any]:
    job_root = Path(str(command["jobRoot"])).resolve(strict=True)
    source = _safe_child(job_root, str(command["source"]), must_exist=True)
    manifest = _safe_child(job_root, str(command["replacementsJson"]), must_exist=True)
    intermediate = _safe_child(job_root, str(command["intermediate"]), must_exist=False)
    fragmented = _safe_child(job_root, str(command["fragmented"]), must_exist=False)
    init_path = _safe_child(job_root, str(command["protectedInit"]), must_exist=False)
    fragment_path = _safe_child(job_root, str(command["protectedFragment"]), must_exist=False)
    for output in [intermediate, fragmented, init_path, fragment_path]:
        if output.exists():
            raise RuntimeError("LIVE_WORKER_OUTPUT_ALREADY_EXISTS")
    adapter._profile = _product_profile
    adapter._rotation_from_ffprobe = lambda _source, _ffprobe: int(command.get("rotation", 0))
    started = time.perf_counter()
    adapter_started = time.perf_counter()
    try:
        receipt = adapter.run(
            SimpleNamespace(
                source=str(source),
                output=str(intermediate),
                replacements_json=str(manifest),
                profile="mp4_h264_mf_product",
                ffprobe="disabled-in-persistent-live-worker",
            )
        )
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_ADAPTER_FILE_NOT_FOUND") from exc
    adapter_wall_ms = round((time.perf_counter() - adapter_started) * 1000, 3)
    remux_started = time.perf_counter()
    try:
        _remux_fragmented(intermediate, source, fragmented)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_REMUX_FILE_NOT_FOUND") from exc
    remux_wall_ms = round((time.perf_counter() - remux_started) * 1000, 3)
    split_started = time.perf_counter()
    try:
        split = _split_fragmented(fragmented, init_path, fragment_path)
    except FileNotFoundError as exc:
        raise RuntimeError("LIVE_WORKER_SPLIT_FILE_NOT_FOUND") from exc
    split_wall_ms = round((time.perf_counter() - split_started) * 1000, 3)
    configuration_started = time.perf_counter()
    configuration = _codec_configuration(fragmented)
    canonical_configuration = state.get("canonical_configuration")
    canonical_init = state.get("canonical_init")
    if canonical_configuration is None:
        state["canonical_configuration"] = configuration
        state["canonical_init"] = init_path.read_bytes()
    elif configuration != canonical_configuration or not isinstance(canonical_init, bytes):
        raise RuntimeError("LIVE_WORKER_CODEC_CONFIGURATION_CHANGED")
    else:
        init_path.write_bytes(canonical_init)
        split["initBytes"] = len(canonical_init)
    configuration_wall_ms = round((time.perf_counter() - configuration_started) * 1000, 3)
    return {
        "status": "PROTECTED_FRAGMENT_READY",
        "adapterReceipt": receipt,
        "split": split,
        "protectedInit": str(init_path),
        "protectedFragment": str(fragment_path),
        "wallMs": round((time.perf_counter() - started) * 1000, 3),
        "stageMetrics": {
            "adapterEncodeWallMs": adapter_wall_ms,
            "remuxWallMs": remux_wall_ms,
            "splitWallMs": split_wall_ms,
            "codecValidationWallMs": configuration_wall_ms,
        },
        "processMetrics": _process_metrics(),
    }


def _response(request_id: str, payload: dict[str, Any]) -> None:
    print(json.dumps({"schemaVersion": SCHEMA, "requestId": request_id, **payload}, separators=(",", ":")), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter-c", required=True)
    args = parser.parse_args()
    adapter_path = Path(args.adapter_c).resolve(strict=True)
    adapter = _load_adapter(adapter_path)
    state: dict[str, Any] = {}
    _response("worker", {"status": "READY", "pid": os.getpid(), "pyav": av.__version__, "numpy": np.__version__})
    for raw in sys.stdin:
        request_id = "unknown"
        try:
            command = json.loads(raw)
            if not isinstance(command, dict):
                raise RuntimeError("LIVE_WORKER_COMMAND_OBJECT_REQUIRED")
            request_id = str(command.get("requestId", "unknown"))
            operation = command.get("operation")
            if operation == "prepare":
                try:
                    _response(request_id, _prepare(command))
                except FileNotFoundError as exc:
                    raise RuntimeError("LIVE_WORKER_PREPARE_FILE_NOT_FOUND") from exc
            elif operation == "prepare_exact_frame":
                try:
                    _response(request_id, _prepare_exact_frame(command))
                except FileNotFoundError as exc:
                    raise RuntimeError("LIVE_WORKER_EXACT_FRAME_FILE_NOT_FOUND") from exc
            elif operation == "write":
                _response(request_id, _write(command, adapter, state))
            elif operation == "shutdown":
                _response(request_id, {"status": "STOPPED"})
                return 0
            elif operation == "ping":
                _response(request_id, {"status": "ALIVE", "pid": os.getpid()})
            else:
                raise RuntimeError("LIVE_WORKER_OPERATION_INVALID")
        except Exception as exc:
            code = str(exc)
            if (
                not code
                or len(code) > 180
                or not code.replace("_", "").replace("-", "").isalnum()
            ):
                code = type(exc).__name__
            _response(request_id, {"status": "FAILED", "errorCode": code})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

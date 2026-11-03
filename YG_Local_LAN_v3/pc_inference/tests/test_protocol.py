import pytest
from protocol import pack_for_test, decode_packet, PacketError


def packet():
    raw = bytes(240 * 320 * 2)
    metadata = {"device_id": "sensor01", "boot_id": 2, "frame_seq": 1,
                "frame_timestamp_us": 1000000, "width": 240, "height": 320,
                "pixel_format": "UYVY422", "servo_angle_deg": 90.0,
                "radar": {"human": 1, "quality": "ok"},
                "phase_samples": [[1, 990000, .03]]}
    return metadata, raw


def test_roundtrip():
    data, raw = packet()
    p = decode_packet(pack_for_test(data, raw))
    assert p.width == 240 and p.frame_seq == 1
    assert p.phase_samples[0] == (1, 990000, .03)


def test_bad_header_and_length():
    data, raw = packet()
    b = pack_for_test(data, raw)
    with pytest.raises(PacketError):
        decode_packet(b"WRONG" + b[5:])
    with pytest.raises(PacketError):
        decode_packet(b[:-1])


def test_reject_path_and_wrong_pixels():
    data, raw = packet()
    data["device_id"] = "../escape"
    with pytest.raises(PacketError):
        decode_packet(pack_for_test(data, raw))
    data["device_id"] = "sensor01"
    with pytest.raises(PacketError):
        decode_packet(pack_for_test(data, raw[:-1]))


def test_reject_nan_values():
    data, raw = packet()
    data["servo_angle_deg"] = float("nan")
    with pytest.raises(PacketError):
        decode_packet(pack_for_test(data, raw))

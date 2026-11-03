from pose_backend import Person
from tracking import TrackingController


def p(x: float, score: float = .9) -> Person:
    return Person(score, (0, 0, 1, 1), {
        "left_shoulder": {"x": x - .05, "y": .4, "score": .9},
        "right_shoulder": {"x": x + .05, "y": .4, "score": .9}})


def test_track_right_and_center():
    t = TrackingController()
    cmd, _ = t.decide([p(.8)], 90, 5, 10, 1)
    assert cmd["mode"] == "track" and 90 < cmd["target_angle_deg"] <= 96
    centered = TrackingController()
    cmd, _ = centered.decide([p(.53)], 90, 5, 10, 1)
    assert cmd["mode"] == "hold" and cmd["reason"] == "centered"


def test_hold_without_target_and_duplicate():
    t = TrackingController()
    cmd, _ = t.decide([], 90, 10, 2, 1)
    assert cmd["mode"] == "hold"
    t.decide([p(.65)], 90, 11, 2, 2)
    dup, _ = t.decide([p(.9)], 90, 11, 2, 2)
    assert dup["reason"] == "repeated_frame"


def test_servo_range_and_direction():
    t = TrackingController(min_deg=30, max_deg=150, direction=-1)
    cmd, _ = t.decide([p(.9)], 31, 3, 1, 1)
    assert cmd["target_angle_deg"] == 30


def test_no_immediate_person_switch():
    t = TrackingController()
    t.decide([p(.2)], 90, 1, 1, 1)
    cmd, _ = t.decide([p(.85)], 90, 2, 1, 2)
    assert cmd["mode"] == "hold" and cmd["reason"] == "target_identity_uncertain"

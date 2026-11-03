import numpy as np
import pytest
from pose_backend import YoloPoseONNX

class DummyInput:
    name = "images"
    shape = [1, 3, 640, 640]

class DummySession:
    def __init__(self, output):
        self.output = output
    def get_inputs(self): return [DummyInput()]
    def run(self, _, feeds):
        assert feeds["images"].shape == (1, 3, 640, 640)
        return [self.output]


def test_onnx_56_channels_letterbox_and_coco():
    raw = np.zeros((1, 56, 8400), dtype=np.float32)
    raw[0, 0:5, 4] = [440, 290, 200, 260, .92]
    # x=440 in letterbox of a portrait 240x320 image => normalized .75
    for i in range(17):
        raw[0, 5 + 3*i: 5 + 3*i + 3, 4] = [440, 250, .9]
    model = YoloPoseONNX.__new__(YoloPoseONNX)
    model.session = DummySession(raw)
    model.input_name = "images"
    model.size = 640
    image = np.zeros((320, 240, 3), dtype=np.uint8)
    people = model.detect(image)
    assert len(people) == 1
    assert people[0].confidence == .92
    assert abs(people[0].landmarks["left_shoulder"]["x"] - .75) < .01
    assert people[0].aiming_x() == .75


def test_incompatible_model_output_fails_closed():
    model = YoloPoseONNX.__new__(YoloPoseONNX)
    model.session = DummySession(np.zeros((1, 7, 100), dtype=np.float32))
    model.input_name = "images"
    model.size = 640
    with pytest.raises(ValueError):
        model.detect(np.zeros((320, 240, 3), dtype=np.uint8))

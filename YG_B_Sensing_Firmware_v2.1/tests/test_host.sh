#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
cc -std=c11 -Wall -Wextra -Werror -I main -I tests tests/test_core.c main/yg_iface.c tests/yg_guidance.c main/yg_fusion.c -lm -o /tmp/yg_v21_b_test
/tmp/yg_v21_b_test

c++ -std=c++11 -O2 -Wall -Wextra -Werror -I main tests/test_radar.cpp -o /tmp/yg_v21_radar_test
/tmp/yg_v21_radar_test

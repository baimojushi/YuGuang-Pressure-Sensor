"""Static BLE configuration and two-mode policy regression checks."""
from pathlib import Path
import re
import unittest

APPS = Path(__file__).resolve().parents[1] / "apps"
SOURCE = (APPS / "main" / "yg_v21" / "yg_a_ble.c").read_text(encoding="utf-8")


def mode_source(debug):
    lines, active = [], [True]
    for line in SOURCE.splitlines():
        directive = line.strip()
        if directive in ("#ifdef CONFIG_YG_BLE_UNENCRYPTED_DEBUG", "#ifndef CONFIG_YG_BLE_UNENCRYPTED_DEBUG"):
            active.append(active[-1] and (debug == directive.startswith("#ifdef")))
        elif directive == "#else":
            active[-1] = active[-2] and not active[-1]
        elif directive == "#endif":
            active.pop()
        elif active[-1]:
            lines.append(line)
    return "\n".join(lines)


class BleConfigTests(unittest.TestCase):
    def test_active_and_default_btu_stack_have_pairing_headroom(self):
        for name in ("sdkconfig", "sdkconfig.defaults"):
            with self.subTest(config=name):
                text = (APPS / name).read_text(encoding="utf-8")
                values = re.findall(r"^CONFIG_BT_BTU_TASK_STACK_SIZE=(\d+)$", text, re.M)
                self.assertEqual(values, ["8192"])

    def test_global_smp_is_not_disabled(self):
        text = (APPS / "sdkconfig").read_text(encoding="utf-8")
        for setting in ("CONFIG_BT_BLE_SMP_ENABLE=y", "CONFIG_BT_BLE_SMP_BOND_NVS_FLASH=y"):
            self.assertIn(setting, text.splitlines())

    def test_debug_only_accepts_fixed_b_without_pairing(self):
        source = mode_source(True)
        self.assertIn("allowed_b={0x68,0xee,0x8f,0x44,0xb5,0xae}", source)
        self.assertIn("return s_open&&s_authorized;", source)
        self.assertIn("#define YG_GATT_AUTH ESP_GATT_AUTH_REQ_NONE", source)
        self.assertNotIn("esp_ble_set_encryption(", source)
        self.assertNotIn("nvs_set_blob(", source)
        self.assertNotIn("ESP_LE_AUTH_REQ_SC_BOND", source)
        self.assertIn("UNENCRYPTED DEBUG: discovering fixed B service", source)

    def test_secure_mode_preserves_authentication_gate(self):
        source = mode_source(False)
        self.assertIn("return s_open&&s_authorized&&s_secure;", source)
        self.assertIn("esp_ble_set_encryption(", source)
        self.assertIn("ESP_LE_AUTH_REQ_SC_BOND", source)
        self.assertIn("#define YG_GATT_AUTH ESP_GATT_AUTH_REQ_NO_MITM", source)

    def test_notifications_are_scoped_and_quality_checks_remain(self):
        for debug in (False, True):
            source = mode_source(debug)
            self.assertIn("p->notify.conn_id!=s_conn", source)
            self.assertIn("memcmp(p->notify.remote_bda,s_bda,6)!=0", source)
            self.assertIn("yg_breath_unpack", source)
            self.assertIn("yg_event_expired", source)
            self.assertIn("yg_status_unpack", source)

    def test_clean_configuration_defaults_to_secure(self):
        text = (APPS / "main" / "Kconfig.projbuild").read_text(encoding="utf-8")
        self.assertIn("default n", text)


if __name__ == "__main__":
    unittest.main()

"""Static policy checks; live GATT transport is verified on the two boards."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "main" / "yg_b_ble.c").read_text(encoding="utf-8")


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


class AuthorizationPolicyTests(unittest.TestCase):
    def test_only_fixed_a_address_is_permitted(self):
        body = re.search(r"static bool permit\([^)]*\)\{(.*?)\n\}", SOURCE, re.S).group(1)
        address = re.search(r"allowed_a=\{([^}]+)\}", body).group(1)
        self.assertEqual(bytes(int(value, 16) for value in address.split(",")), bytes.fromhex("68ee8f44bdb6"))
        self.assertIn("return memcmp(bda,allowed_a,sizeof(allowed_a))==0;", body)
        self.assertNotIn("||", body)
        self.assertNotIn("pairing_until", SOURCE)

    def test_whitelist_gates_writes_and_notifications_in_both_modes(self):
        for debug in (False, True):
            source = mode_source(debug)
            self.assertIn("if(!permit(remote))", source)
            self.assertIn("return connected&&permit(remote)", source)
            self.assertIn("if(!link_ready()||p->write.is_prep)break;", source)
            self.assertIn("if(link_ready()&&subscribed", source)

    def test_debug_does_not_require_pairing_or_encrypted_permissions(self):
        source = mode_source(True)
        self.assertNotIn("esp_ble_set_encryption(", source)
        self.assertNotIn("ESP_LE_AUTH_REQ_SC_BOND", source)
        self.assertNotIn("ESP_GATT_PERM_WRITE_ENCRYPTED", source)
        self.assertNotIn("ESP_GATT_PERM_READ_ENCRYPTED", source)
        self.assertIn("#define YG_READ_PERM ESP_GATT_PERM_READ", source)
        self.assertIn("#define YG_WRITE_PERM ESP_GATT_PERM_WRITE", source)
        self.assertIn("UNENCRYPTED DEBUG", source)

    def test_secure_mode_still_requires_encryption(self):
        source = mode_source(False)
        self.assertIn("return connected&&permit(remote)&&secure;", source)
        self.assertIn("ESP_LE_AUTH_REQ_SC_BOND", source)
        self.assertIn("ESP_GATT_PERM_WRITE_ENCRYPTED", source)
        self.assertIn("esp_ble_set_encryption(", source)

    def test_clean_configuration_defaults_to_secure(self):
        text = (ROOT / "main" / "Kconfig.projbuild").read_text(encoding="utf-8")
        self.assertIn("default n", text)


if __name__ == "__main__":
    unittest.main()

# BIOPHLX source baseline

Verified against GitHub on 2026-10-19.

- App base: [75d06cb25ccc8b27dd328bc34678871dc1ee4c0e](https://github.com/Lfarmer2177/Biophlx-Production-Code-Upload/commit/75d06cb25ccc8b27dd328bc34678871dc1ee4c0e).
- Latest firmware repository head: [10cb763b8c58edbec43ad2bceb2cbbd8b5700d64](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64).
- Firmware code: [1.3.11 / b3fb0b35b6e149dec1aef027c0419c9c51e4460c](https://github.com/Lfarmer2177/BiophlxFirmwareCode/commit/b3fb0b35b6e149dec1aef027c0419c9c51e4460c). Anatoli / arkhipenko; latest later commit adds OTA guides.
- Backend findings refer to the retained October 4, 2026 AWS review, not a new live audit. Private AWS exports and customer data are not copied here. Revalidate deployed schemas and authorization in staging before migration.
- Proposed scope is based on the user's overall-direction approval and requirement to keep bands and sets in one combined review. Detailed screen decisions are not all approved or implemented.

## Pinned firmware files

- [include/Ota.h](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/include/Ota.h)
- [src/Ota.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ota.cpp)
- [include/Configuration.h](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/include/Configuration.h)
- [include/BLE.h](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/include/BLE.h)
- [src/Ble.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Ble.cpp)
- [src/hal/esp32/hal_ota_esp32.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/hal/esp32/hal_ota_esp32.cpp)
- [src/Devices.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Devices.cpp)
- [src/Buttons.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Buttons.cpp)
- [src/Exercises.cpp](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Exercises.cpp)
- [platformio.ini](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/platformio.ini)
- [src/Changelog.txt](https://github.com/Lfarmer2177/BiophlxFirmwareCode/blob/10cb763b8c58edbec43ad2bceb2cbbd8b5700d64/biophlx/firmware/v3/esp32/source/src/Changelog.txt)

No firmware edits, builds, flashes or pushes were performed. No AWS deployment or production database writes were performed.

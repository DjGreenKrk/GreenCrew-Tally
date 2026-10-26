# Builds the crew password for the setup access point into the firmware,
# from the GC_SETUP_PASSWORD environment variable. Never set it in CI: the
# repository and its build artifacts are public, and the password can be
# read from the firmware file.
import os

Import("env")  # noqa: F821 (provided by PlatformIO)

password = os.environ.get("GC_SETUP_PASSWORD", "")
if password:
    if not 8 <= len(password) <= 63 or any(not " " <= c <= "~" for c in password):
        print("GC_SETUP_PASSWORD needs 8 to 63 printable ASCII characters")
        env.Exit(1)  # noqa: F821
    # As character codes, so no character needs escaping on the command line
    codes = ",".join(str(ord(c)) for c in password)
    env.Append(CPPDEFINES=[("GC_CREW_SETUP_PASSWORD_CODES", codes)])  # noqa: F821
    print("Crew setup password: built in")
else:
    print("Crew setup password: none (GC_SETUP_PASSWORD not set)")

# The kit's targets (link, install, reload, logs, pack, check, nested, ...;
# 'make' alone lists them), then Games Library's own.
include scripts/kit.mk

.PHONY: scan stalls

# Scan the installed games into the real cache: the user's to run.
scan:
	@$(DEV) scan

# Watch for desktop freezes; the log goes to dist/stalls.log.
stalls:
	@$(DEV) stalls

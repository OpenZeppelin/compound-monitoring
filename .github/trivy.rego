
package trivy

import data.lib.trivy

default ignore = false

# Ignore CSRF
ignore {
	# https://cwe.mitre.org/data/definitions/352.html
	input.AVDID[_] == "AVD-DS-0002"
	input.avd_id[_] == "AVD-DS-0002"
}
#!/bin/bash
# Double-click this file to open the website editor (Mac).
cd "$(dirname "$0")" || exit 1
python3 "_editor/server.py"
if [ $? -ne 0 ]; then
  echo
  echo "The editor could not start (see the message above)."
  echo "If macOS offered to install 'Command Line Tools', click Install, wait for it to finish,"
  echo "then double-click 'Edit Website (Mac).command' again."
  read -r -p "Press Return to close this window." _
fi

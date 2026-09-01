# Gunicorn automatically reads this file (if present in its working
# directory) without needing anything in Render's Start Command field.
#
# - timeout: gunicorn's default is 30s. The chat endpoint's own HTTP call
#   to Gemini can take up to 60s (see app/routes/chat.py), so the worker
#   itself needs longer than that or it gets killed mid-request before it
#   can even return its own error response.
# - workers/threads: one process with a few threads, rather than several
#   full processes, keeps memory usage well under Render's free-tier
#   512MB limit — this app previously hit an OOM kill with the heavier
#   google-genai SDK loaded across multiple workers.
workers = 1
threads = 4
timeout = 90

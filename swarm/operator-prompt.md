/operator Run phase 1 of the OxHack swarm. Read swarm/brief.md first.

Start three sessions in this project with sessions.start, provider Pi, model
opencode-go/muse-spark-1.3-contributor (fall back to opencode-go/deepseek-v4.1-flash only if
Muse is unavailable), current checkout, placement right then down to tile them. Put them in a
folder named "OxHack swarm". Prompts:

1. "/goal-direct You are the health worker. Read swarm/brief.md and do the job for the lens
   'health'. Deliverable: swarm/industry-health.md meeting the brief's Output section.
   Stay in this folder, curl public URLs only, never write another worker's file."
2. Same, lens 'money', file swarm/industry-money.md.
3. Same, lens 'move', file swarm/industry-move.md.

Check each session with sessions.read every few minutes. When all three files exist, read
them, check that every ✅ source shows the fact that was checked, re-run two of the curls
yourself, then write swarm/industries.md: one merged ranked table of all industries and
your top three with reasons. Stop the three sessions when done. Do not start phase 2.

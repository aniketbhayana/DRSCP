# Integration Checklist — DRSCP
**Owner: ALL | Touched only in Phase 5 | Status: PLACEHOLDER**

## Checklist (run together in Phase 5)

- [ ] 1. Drop and recreate DB with `reset_db` — zero errors
- [ ] 2. Start backend (`npm run dev`) — no errors
- [ ] 3. Start frontend (`npm run dev`) — loads in browser
- [ ] 4. Full scenario: submit request → priority computed → appears in ranked queue → allocate bed → occupancy updates → audit log entry exists
- [ ] 5. Concurrency demo: two sessions, one allocation succeeds, one fails cleanly
- [ ] 6. Login as each role; verify allowed/denied actions
- [ ] 7. Negative cases: over-capacity, out-of-stock, duplicate request, invalid status transition
- [ ] 8. All three PROGRESS files show every deliverable as "done" or "tested"
- [ ] 9. `demo_script.md` written and rehearsed

# QA Smoke Tests (Phase 1)

## Preconditions
- `ENABLE_LIKES=true`
- `ENABLE_COMMENTS=true`
- `ENABLE_NOTIFICATIONS=true`
- `ENABLE_VAULT=true`
- `ENABLE_SCHEDULED_POSTS=true`

## API Smoke (curl)
```bash
# Replace TOKEN and IDs first.
curl -H "Authorization: Bearer $TOKEN" -X POST "$API/posts/$POST_ID/like"
curl -H "Authorization: Bearer $TOKEN" "$API/posts/$POST_ID/likes"
curl -H "Authorization: Bearer $TOKEN" -X POST "$API/posts/$POST_ID/comments" -H "Content-Type: application/json" -d '{"body":"hello"}'
curl -H "Authorization: Bearer $TOKEN" "$API/posts/$POST_ID/comments"
curl -H "Authorization: Bearer $TOKEN" "$API/notifications"
curl -H "Authorization: Bearer $TOKEN" -X POST "$API/notifications/read-all"
curl -H "Authorization: Bearer $TOKEN" "$API/media/mine?type=image"
```

## UI Smoke
- Feed card shows `Like` and `Comment` actions.
- Clicking like updates count immediately and persists after refresh.
- Comment panel allows adding a comment; count increments.
- Navbar shows bell link and unread counter when logged in.
- `/notifications` renders notifications and allows mark read/read-all.
- New post page allows schedule datetime and vault selection.

## Scheduled Post Verification (2 minutes)
1. Create post with `publish_at` 2 minutes in future.
2. Confirm post status is `SCHEDULED` in API response.
3. Wait 2+ minutes with Celery beat running.
4. Verify status transitions to `PUBLISHED` and post appears in feed/profile.

## Regression Checks
- Existing DM send/list still works.
- Existing tips/PPV purchases unaffected.
- `/health` and `/ready` remain green.

## PPV Message Unlock Smoke
Preconditions:
- `ENABLE_PPVM=true` in staging
- `NEXT_PUBLIC_ENABLE_PPVM=true` in web task env
- Stripe test keys configured

Flow:
1. Fan opens creator profile and clicks `Message` to create/open conversation.
2. Creator opens same conversation, selects media from vault, enables `Lock media (PPV)`, sets price (e.g. `5`), sends.
3. Fan sees locked media tile with `Unlock for $5.00`.
4. Fan completes Stripe test payment in unlock form.
5. Message refreshes and fan can click `View media` (presigned URL issued).
6. Fan repeats unlock action and receives already-unlocked behavior (no extra charge).
7. Non-participant user cannot access `/dm/message-media/{id}/download-url`.


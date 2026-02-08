# Service Role Key Rotation Runbook

**Purpose:** Rotate the Supabase service role key to maintain security hygiene and limit exposure window if key compromise occurs.

**Frequency:** Quarterly (every 3 months) or immediately if compromise suspected

**Duration:** 15-20 minutes

**Risk Level:** Medium (requires careful execution to avoid downtime)

---

## Overview

The Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses Row Level Security (RLS) policies and grants full database access. While this key is never exposed client-side in our application, rotating it regularly is a security best practice.

**Current Usage:**
- Used exclusively in server-side API routes (`/app/api/*`)
- Accessed only through `createServiceClient()` wrapper with audit logging
- Never exposed in client-side code (verified by pre-commit hooks)

---

## Prerequisites

**Before You Begin:**

- [ ] Schedule rotation during low-traffic period (recommended: weekends or late evening UTC)
- [ ] Notify team 48 hours in advance via Slack/email
- [ ] Ensure access to:
  - Supabase dashboard (admin access)
  - Production deployment platform (Vercel/hosting admin access)
  - Staging environment for testing
  - Team password manager (1Password/LastPass)
- [ ] Backup current `.env` files
- [ ] Verify rollback procedure is understood

**Estimated Downtime:** 0-2 minutes (if deployment is instant)

---

## Step 1: Preparation (5 minutes)

### 1.1 Verify Current State

```bash
# Check current key is working
curl -X GET https://your-app.vercel.app/api/portal/me \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"

# Expected: 200 OK
```

### 1.2 Document Current Key

```bash
# Save current key to secure location (for rollback)
echo "Old Service Role Key: $SUPABASE_SERVICE_ROLE_KEY" >> rotation-backup-$(date +%Y%m%d).txt

# Store in team password manager under:
# "Supabase Service Role Key (Pre-Rotation YYYY-MM-DD)"
```

### 1.3 Notify Team

**Slack/Email Template:**
```
🔐 Service Role Key Rotation Scheduled

When: [DATE] at [TIME UTC]
Duration: ~15 minutes
Impact: Brief API disruption possible (0-2 min)

Action Required: None (automatic deployment)
Questions: Contact @security-team
```

---

## Step 2: Generate New Key (2 minutes)

### 2.1 Access Supabase Dashboard

1. Navigate to: https://app.supabase.com/project/YOUR_PROJECT_ID
2. Go to: **Project Settings** → **API**
3. Scroll to: **Service Role Key** section

### 2.2 Generate New Key

1. Click: **"Generate new service role key"**
2. **WARNING:** Do NOT revoke old key yet (keep both keys active)
3. Copy new key to clipboard
4. Verify format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT format)

### 2.3 Secure New Key

```bash
# Store new key in team password manager under:
# "Supabase Service Role Key (Active)"

# Save to secure temporary file for deployment
echo "SUPABASE_SERVICE_ROLE_KEY=NEW_KEY_HERE" >> .env.rotation
chmod 600 .env.rotation
```

---

## Step 3: Test in Staging (3 minutes)

### 3.1 Update Staging Environment

**For Vercel:**
```bash
# Update staging environment variable
vercel env add SUPABASE_SERVICE_ROLE_KEY staging

# Paste new key when prompted
# Confirm: Environment variable updated
```

**For other platforms:**
- AWS Amplify: Console → Environment Variables → Edit
- Railway: Settings → Variables → Edit
- Render: Environment → Edit

### 3.2 Deploy to Staging

```bash
# Trigger staging deployment
vercel deploy --target staging

# Wait for deployment to complete (~1-2 min)
```

### 3.3 Test Staging Endpoints

```bash
# Test authenticated endpoint
curl -X GET https://staging.your-app.vercel.app/api/portal/me \
  -H "Authorization: Bearer STAGING_TEST_TOKEN"

# Expected: 200 OK with user data

# Test admin endpoint (if you have admin token)
curl -X POST https://staging.your-app.vercel.app/api/nhome/fix-completed-sessions \
  -H "Authorization: Bearer STAGING_ADMIN_TOKEN"

# Expected: 200 OK or 403 (not 500)
```

**If tests fail:** Stop here and investigate. Do NOT proceed to production.

---

## Step 4: Update Production (3 minutes)

### 4.1 Update Production Environment

**For Vercel:**
```bash
# Update production environment variable
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Paste new key when prompted
# Confirm: Environment variable updated
```

### 4.2 Deploy to Production

```bash
# Option A: Trigger deployment via CLI
vercel deploy --prod

# Option B: Trigger via dashboard
# Vercel Dashboard → Deployments → Redeploy (use existing build)
```

### 4.3 Monitor Deployment

```bash
# Watch deployment logs
vercel logs --prod --follow

# Expected: No errors, successful build
```

**Deployment Time:** 1-2 minutes typical

---

## Step 5: Verification (5 minutes)

### 5.1 Test Critical Endpoints

```bash
# Test 1: Portal authentication
curl -X GET https://your-app.vercel.app/api/portal/me \
  -H "Authorization: Bearer PRODUCTION_TEST_TOKEN"

# Expected: 200 OK

# Test 2: Apartment list
curl -X GET https://your-app.vercel.app/api/portal/apartments/list \
  -H "Authorization: Bearer PRODUCTION_TEST_TOKEN"

# Expected: 200 OK with apartment data

# Test 3: Service role operation (admin only)
curl -X POST https://your-app.vercel.app/api/nhome/fix-completed-sessions \
  -H "Authorization: Bearer PRODUCTION_ADMIN_TOKEN"

# Expected: 200 OK or 403 (not 500 error)
```

### 5.2 Monitor Application Logs

```bash
# Check for errors in last 5 minutes
vercel logs --prod --since 5m | grep ERROR

# Expected: No service role authentication errors
```

### 5.3 Check Error Tracking

**If using Sentry/Datadog:**
- Navigate to: Error Dashboard → Last 5 minutes
- Filter: "Supabase" OR "service role" OR "authentication"
- Expected: No new errors

### 5.4 User Acceptance Test

**Manual verification:**
1. Login to production app as test user
2. Navigate to: Dashboard → Apartments
3. Click: Any apartment → View details
4. Verify: Data loads correctly
5. Verify: No console errors

---

## Step 6: Revoke Old Key (2 minutes)

**⚠️ WARNING:** Only proceed if Step 5 verification passed completely.

### 6.1 Revoke Old Key in Supabase

1. Go to: Supabase Dashboard → Project Settings → API
2. Find: **Old service role key** in key list
3. Click: **"Revoke"** next to old key
4. Confirm: "Yes, revoke this key"

### 6.2 Verify Old Key is Revoked

```bash
# Test old key (should fail)
export OLD_KEY="paste_old_key_here"

curl -X GET "https://YOUR_PROJECT.supabase.co/rest/v1/projects?select=*" \
  -H "apikey: $OLD_KEY" \
  -H "Authorization: Bearer $OLD_KEY"

# Expected: 401 Unauthorized or 403 Forbidden
```

---

## Step 7: Documentation (3 minutes)

### 7.1 Update Team Password Manager

**1Password/LastPass:**
- Update: "Supabase Service Role Key (Active)"
- Add note: "Rotated on YYYY-MM-DD by [YOUR_NAME]"
- Archive: "Supabase Service Role Key (Pre-Rotation YYYY-MM-DD)"

### 7.2 Log Rotation Event

**Create entry in:** `docs/security/rotation-log.md`

```markdown
## YYYY-MM-DD - Service Role Key Rotation

- **Performed by:** [YOUR_NAME]
- **Date/Time:** YYYY-MM-DD HH:MM UTC
- **Reason:** Quarterly rotation / Suspected compromise
- **Downtime:** X minutes
- **Issues:** None / [Describe any issues]
- **Rollback Required:** No
- **Next Rotation Due:** YYYY-MM-DD (3 months)
```

### 7.3 Notify Team of Completion

**Slack/Email Template:**
```
✅ Service Role Key Rotation Complete

Completed: [TIME UTC]
Downtime: X minutes
Status: All systems operational
New Key: Active and verified
Old Key: Revoked

Next rotation: [DATE in 3 months]
```

### 7.4 Schedule Next Rotation

```bash
# Add calendar reminder for 3 months from now
# Subject: "Quarterly Service Role Key Rotation"
# Reminder: 48 hours before
```

---

## Rollback Procedure

**If issues occur during rotation:**

### Immediate Rollback (< 5 minutes)

1. **Restore old key in production:**
   ```bash
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   # Paste OLD key from backup
   ```

2. **Redeploy production:**
   ```bash
   vercel deploy --prod
   ```

3. **Verify rollback:**
   ```bash
   curl -X GET https://your-app.vercel.app/api/portal/me \
     -H "Authorization: Bearer PRODUCTION_TEST_TOKEN"
   # Expected: 200 OK
   ```

4. **Do NOT revoke old key** (it's now active again)

5. **Investigate issue:**
   - Check Supabase logs for authentication errors
   - Verify new key format is correct
   - Test new key manually against Supabase API
   - Review deployment logs for errors

### Rollback Verification

- [ ] Application endpoints returning 200 OK
- [ ] No authentication errors in logs
- [ ] Users can access application normally
- [ ] Admin operations working

---

## Troubleshooting

### Issue: "Invalid JWT" errors after rotation

**Cause:** New key not properly deployed or wrong key copied

**Solution:**
```bash
# Verify environment variable updated
vercel env ls production | grep SUPABASE_SERVICE_ROLE_KEY

# Re-check new key in Supabase dashboard
# Copy key again and update environment
```

### Issue: "Unauthorized" errors after rotation

**Cause:** Old key revoked before new key deployed

**Solution:**
```bash
# Rollback to old key (see Rollback Procedure)
# Generate new key again
# Deploy new key BEFORE revoking old key
```

### Issue: Deployment fails during rotation

**Cause:** Build errors unrelated to key rotation

**Solution:**
```bash
# Check deployment logs
vercel logs --prod

# If build fails, fix build errors first
# Rotation can wait until build is stable
```

### Issue: RLS policies blocking service role

**Cause:** RLS misconfiguration (should not occur - service role bypasses RLS)

**Solution:**
```bash
# This should not happen, but verify in Supabase SQL editor:
SELECT * FROM projects LIMIT 1;

# Should return data (service role bypasses RLS)
# If fails, contact Supabase support
```

---

## Security Best Practices

**After Rotation:**

- [ ] Delete rotation backup files: `rm rotation-backup-*.txt .env.rotation`
- [ ] Clear shell history: `history -c` (if keys were in commands)
- [ ] Verify keys not committed to git: `git log -p | grep "SUPABASE_SERVICE_ROLE_KEY"`
- [ ] Update team documentation
- [ ] Schedule next rotation (3 months)

**Ongoing:**

- [ ] Run pre-commit hooks: `npm run pre-commit` (verifies no client-side key exposure)
- [ ] Monitor service role usage logs weekly
- [ ] Review access logs for suspicious patterns
- [ ] Keep team password manager updated

---

## Contacts

**Issues During Rotation:**
- On-call engineer: [PHONE/SLACK]
- Security team: [EMAIL/SLACK]
- Supabase support: support@supabase.io

**Escalation:**
- CTO/Technical Lead: [CONTACT]
- CEO (if data breach suspected): [CONTACT]

---

## Appendix: Key Rotation Checklist

Print and check off during rotation:

**Preparation:**
- [ ] Team notified 48h in advance
- [ ] Low-traffic period scheduled
- [ ] Current key backed up to password manager
- [ ] Staging environment ready for testing

**Execution:**
- [ ] New key generated in Supabase dashboard
- [ ] New key tested in staging environment
- [ ] Staging tests passed (all endpoints 200 OK)
- [ ] New key deployed to production
- [ ] Production deployment successful
- [ ] All verification tests passed
- [ ] Old key revoked in Supabase dashboard
- [ ] Old key verified as revoked

**Documentation:**
- [ ] Password manager updated
- [ ] Rotation logged in rotation-log.md
- [ ] Team notified of completion
- [ ] Next rotation scheduled (3 months)
- [ ] Backup files deleted

**Sign-off:**
- Rotation completed by: ________________
- Date/Time: ________________
- Issues encountered: ________________
- Next rotation due: ________________

---

**Version:** 1.0
**Last Updated:** 2026-02-07
**Next Review:** 2026-05-07

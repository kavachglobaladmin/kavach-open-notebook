# Chat with Source - Deployment Guide

## 📋 Overview

This guide walks through deploying the complete Chat with Source fix (backend + frontend).

---

## 🔧 Files to Deploy

### Backend
```
api/routers/source_chat.py
```

### Frontend
```
frontend/src/lib/api/source-chat.ts
```

---

## 🚀 Deployment Steps

### Step 1: Backend Deployment

#### Option A: Direct File Replacement
```bash
# Backup original
cp api/routers/source_chat.py api/routers/source_chat.py.backup

# Replace with updated version
cp /path/to/updated/source_chat.py api/routers/source_chat.py

# Verify syntax
python -m py_compile api/routers/source_chat.py
```

#### Option B: Docker
```bash
# If using Docker, rebuild the image
docker build -t open-notebook-api:latest .

# Stop old container
docker stop api-container

# Start new container
docker run -d --name api-container open-notebook-api:latest
```

#### Option C: Systemd
```bash
# Stop service
systemctl stop open-notebook-api

# Replace file
cp /path/to/updated/source_chat.py api/routers/source_chat.py

# Start service
systemctl start open-notebook-api

# Check status
systemctl status open-notebook-api
```

### Step 2: Frontend Deployment

#### Option A: Local Development
```bash
# Replace file
cp /path/to/updated/source-chat.ts frontend/src/lib/api/source-chat.ts

# Rebuild
cd frontend
npm run build
# or
yarn build

# Start dev server
npm run dev
# or
yarn dev
```

#### Option B: Docker
```bash
# Rebuild frontend image
docker build -f Dockerfile.frontend -t open-notebook-frontend:latest .

# Stop old container
docker stop frontend-container

# Start new container
docker run -d --name frontend-container open-notebook-frontend:latest
```

#### Option C: Production Build
```bash
# Replace file
cp /path/to/updated/source-chat.ts frontend/src/lib/api/source-chat.ts

# Build for production
npm run build

# Start production server
npm start
```

---

## ✅ Verification Steps

### Backend Verification

#### Check Logs
```bash
# Look for [SourceChat] entries
tail -f /var/log/open-notebook/api.log | grep "\[SourceChat\]"

# Should see:
# [SourceChat] Context built: XXXX chars, X insights
# [SourceChat] Streaming response for: ...
# [SourceChat] Response complete: XXXX chars
```

#### Check API Health
```bash
# Test API endpoint
curl -X GET http://localhost:5055/api/health

# Should return 200 OK
```

### Frontend Verification

#### Check Build
```bash
# Verify build completed
ls -la frontend/.next/

# Should have build artifacts
```

#### Check Browser Console
```
1. Open browser DevTools (F12)
2. Go to Console tab
3. Open Chat with Source
4. Send a message
5. Should NOT see 401 error
6. Should see streaming response
```

---

## 🧪 Testing Procedure

### Test 1: Authentication
```
1. Open Chat with Source
2. Send a message: "Hello"
3. Check browser console
4. ✅ Should NOT see 401 error
5. ✅ Should see response streaming
```

### Test 2: Response Quality
```
1. Upload a document with specific information
2. Ask: "Who is [name from document]?"
3. ✅ Should get detailed answer
4. ✅ Should include all mentions
5. ✅ Should reference source content
```

### Test 3: Comparison
```
1. Test Chat with Notebook
   - Send message
   - Verify response streams
   - Verify suggested questions appear

2. Test Chat with Source
   - Send message
   - Verify response streams
   - Verify suggested questions appear

3. ✅ Both should work identically
```

### Test 4: Error Handling
```
1. Send message with empty source
   - Should handle gracefully
   - Should return "Not found in source"

2. Send message with large document
   - Should handle properly
   - Should stream response

3. Send message with special characters
   - Should handle properly
   - Should not cause errors
```

---

## 🔍 Troubleshooting

### Issue: Still Getting 401 Error

**Cause:** Frontend not using correct auth headers

**Solution:**
```bash
# 1. Verify frontend was rebuilt
ls -la frontend/.next/

# 2. Clear browser cache
# - Open DevTools (F12)
# - Right-click refresh button
# - Select "Empty cache and hard refresh"

# 3. Check sessionStorage
# - Open DevTools Console
# - Type: sessionStorage.getItem('kavach_api_password')
# - Should return a value

# 4. Verify API password is set
# - Check .env file
# - Verify OPEN_NOTEBOOK_PASSWORD is set
```

### Issue: Responses Not Streaming

**Cause:** Backend not streaming properly

**Solution:**
```bash
# 1. Check backend logs
tail -f /var/log/open-notebook/api.log

# 2. Look for errors
grep "ERROR" /var/log/open-notebook/api.log

# 3. Verify API is running
curl -X GET http://localhost:5055/api/health

# 4. Check network in DevTools
# - Open DevTools (F12)
# - Go to Network tab
# - Send message
# - Check response headers
# - Should see: Content-Type: text/plain
```

### Issue: Responses Too Short

**Cause:** Context not being used properly

**Solution:**
```bash
# 1. Check backend logs for [SourceChat] entries
grep "\[SourceChat\]" /var/log/open-notebook/api.log

# 2. Verify context is being built
# Should see: "Context built: XXXX chars"

# 3. Check source document
# - Verify document is uploaded
# - Verify document has content
# - Verify document is indexed

# 4. Check system prompt
# - Verify backend was updated
# - Verify new system prompt is being used
```

---

## 📊 Deployment Checklist

### Pre-Deployment
- [ ] Backup current files
- [ ] Review changes
- [ ] Test in development
- [ ] Verify no syntax errors

### Backend Deployment
- [ ] Replace `api/routers/source_chat.py`
- [ ] Verify syntax: `python -m py_compile api/routers/source_chat.py`
- [ ] Restart API server
- [ ] Check logs for errors
- [ ] Verify `[SourceChat]` entries in logs

### Frontend Deployment
- [ ] Replace `frontend/src/lib/api/source-chat.ts`
- [ ] Run: `npm run build` or `yarn build`
- [ ] Verify build completed
- [ ] Restart frontend server
- [ ] Clear browser cache

### Testing
- [ ] Test Chat with Source
- [ ] Verify no 401 errors
- [ ] Verify responses stream
- [ ] Verify suggested questions appear
- [ ] Compare with Chat with Notebook
- [ ] Test with various documents
- [ ] Test error cases

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Monitor performance
- [ ] Gather user feedback
- [ ] Document any issues

---

## 🔄 Rollback Plan

If issues occur:

### Backend Rollback
```bash
# Restore backup
cp api/routers/source_chat.py.backup api/routers/source_chat.py

# Restart API
systemctl restart open-notebook-api
```

### Frontend Rollback
```bash
# Restore backup
cp frontend/src/lib/api/source-chat.ts.backup frontend/src/lib/api/source-chat.ts

# Rebuild
npm run build

# Restart frontend
systemctl restart open-notebook-frontend
```

---

## 📝 Deployment Log Template

```
Deployment Date: [DATE]
Deployed By: [NAME]
Environment: [DEV/STAGING/PROD]

Backend:
- [ ] File replaced
- [ ] Syntax verified
- [ ] Server restarted
- [ ] Logs checked
- [ ] [SourceChat] entries visible

Frontend:
- [ ] File replaced
- [ ] Build completed
- [ ] Server restarted
- [ ] Cache cleared
- [ ] No console errors

Testing:
- [ ] Chat with Source works
- [ ] No 401 errors
- [ ] Responses stream
- [ ] Suggested questions appear
- [ ] Chat with Notebook still works

Issues:
[List any issues encountered]

Resolution:
[How issues were resolved]

Status: ✅ COMPLETE / ❌ FAILED
```

---

## 🎯 Success Criteria

Deployment is successful when:

✅ Backend logs show `[SourceChat]` entries
✅ Frontend builds without errors
✅ Chat with Source works without 401 errors
✅ Responses stream in real-time
✅ Suggested questions appear
✅ Chat with Notebook still works
✅ No errors in browser console
✅ No errors in server logs

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section
2. Review the logs
3. Verify both files were deployed
4. Verify servers were restarted
5. Clear browser cache
6. Try in incognito mode

---

## ✨ Summary

### What to Deploy
- `api/routers/source_chat.py` (backend)
- `frontend/src/lib/api/source-chat.ts` (frontend)

### How to Deploy
1. Replace files
2. Rebuild frontend
3. Restart servers
4. Verify logs
5. Test functionality

### Expected Result
✅ Chat with Source works perfectly
✅ No more 401 errors
✅ Better responses
✅ Proper authentication

---

**Deployment is straightforward and low-risk. All changes are backward compatible.**

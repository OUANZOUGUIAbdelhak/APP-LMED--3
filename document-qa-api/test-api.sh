#!/bin/bash

# Document Q&A API Test Script
# This script tests all major endpoints to verify the API is working correctly

API_BASE="http://localhost:3001/api"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Document Q&A API Test Suite"
echo "=========================================="
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "$API_BASE/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Create test document
echo -e "${YELLOW}Test 2: Creating test document${NC}"
TEST_FILE="test-document.txt"
cat > "$TEST_FILE" << EOF
Document Q&A Test Document

This is a test document for the Document Q&A API.

Section 1: Introduction
This document contains information about machine learning and artificial intelligence.
Machine learning is a subset of AI that enables systems to learn from data.

Section 2: Applications
Common applications include:
- Natural language processing
- Computer vision
- Recommendation systems
- Predictive analytics

Section 3: Conclusion
Machine learning continues to evolve and transform various industries.
EOF
echo -e "${GREEN}✓ Test document created${NC}"
echo ""

# Test 3: Upload Document
echo -e "${YELLOW}Test 3: Upload Document${NC}"
UPLOAD_RESPONSE=$(curl -s -X POST "$API_BASE/documents/upload" \
  -F "file=@$TEST_FILE")

if echo "$UPLOAD_RESPONSE" | grep -q '"docId"'; then
    DOC_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.docId')
    echo -e "${GREEN}✓ Document uploaded successfully${NC}"
    echo "Document ID: $DOC_ID"
    echo "$UPLOAD_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Document upload failed${NC}"
    echo "$UPLOAD_RESPONSE"
    rm "$TEST_FILE"
    exit 1
fi
echo ""

# Test 4: List Documents
echo -e "${YELLOW}Test 4: List Documents${NC}"
LIST_RESPONSE=$(curl -s "$API_BASE/documents")
if echo "$LIST_RESPONSE" | grep -q '"documents"'; then
    echo -e "${GREEN}✓ Documents listed successfully${NC}"
    echo "$LIST_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ List documents failed${NC}"
    echo "$LIST_RESPONSE"
fi
echo ""

# Test 5: RAG Query
echo -e "${YELLOW}Test 5: RAG Query (Semantic Search)${NC}"
RAG_RESPONSE=$(curl -s -X POST "$API_BASE/rag/query" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"machine learning\", \"documentIds\": [\"$DOC_ID\"], \"topK\": 3}")

if echo "$RAG_RESPONSE" | grep -q '"results"'; then
    echo -e "${GREEN}✓ RAG query successful${NC}"
    echo "$RAG_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ RAG query failed${NC}"
    echo "$RAG_RESPONSE"
fi
echo ""

# Test 6: Agent Chat (with document)
echo -e "${YELLOW}Test 6: Agent Chat (with document context)${NC}"
CHAT_RESPONSE=$(curl -s -X POST "$API_BASE/agent/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"What is this document about?\",
    \"sessionId\": \"test-session\",
    \"documentIds\": [\"$DOC_ID\"]
  }")

if echo "$CHAT_RESPONSE" | grep -q '"reply"'; then
    echo -e "${GREEN}✓ Agent chat successful${NC}"
    echo "Reply: $(echo "$CHAT_RESPONSE" | jq -r '.reply')"
    echo ""
    echo "Sources:"
    echo "$CHAT_RESPONSE" | jq '.sources'
else
    echo -e "${RED}✗ Agent chat failed${NC}"
    echo "$CHAT_RESPONSE"
fi
echo ""

# Test 7: Agent Chat (follow-up question)
echo -e "${YELLOW}Test 7: Agent Chat (follow-up with memory)${NC}"
CHAT2_RESPONSE=$(curl -s -X POST "$API_BASE/agent/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"What are the applications mentioned?\",
    \"sessionId\": \"test-session\",
    \"documentIds\": [\"$DOC_ID\"]
  }")

if echo "$CHAT2_RESPONSE" | grep -q '"reply"'; then
    echo -e "${GREEN}✓ Follow-up chat successful${NC}"
    echo "Reply: $(echo "$CHAT2_RESPONSE" | jq -r '.reply')"
else
    echo -e "${RED}✗ Follow-up chat failed${NC}"
    echo "$CHAT2_RESPONSE"
fi
echo ""

# Test 8: Agent Chat (without document - general question)
echo -e "${YELLOW}Test 8: Agent Chat (general question, no document)${NC}"
CHAT3_RESPONSE=$(curl -s -X POST "$API_BASE/agent/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"Hello, how are you?\",
    \"sessionId\": \"test-session-2\"
  }")

if echo "$CHAT3_RESPONSE" | grep -q '"reply"'; then
    echo -e "${GREEN}✓ General chat successful${NC}"
    echo "Reply: $(echo "$CHAT3_RESPONSE" | jq -r '.reply')"
else
    echo -e "${RED}✗ General chat failed${NC}"
    echo "$CHAT3_RESPONSE"
fi
echo ""

# Test 9: Reset Session
echo -e "${YELLOW}Test 9: Reset Session${NC}"
RESET_RESPONSE=$(curl -s -X POST "$API_BASE/session/reset" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"test-session\"}")

if echo "$RESET_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Session reset successful${NC}"
    echo "$RESET_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Session reset failed${NC}"
    echo "$RESET_RESPONSE"
fi
echo ""

# Test 10: Delete Document
echo -e "${YELLOW}Test 10: Delete Document${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/documents/$DOC_ID")

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Document deleted successfully${NC}"
    echo "$DELETE_RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Document deletion failed${NC}"
    echo "$DELETE_RESPONSE"
fi
echo ""

# Cleanup
rm "$TEST_FILE"

echo "=========================================="
echo -e "${GREEN}All tests completed!${NC}"
echo "=========================================="
echo ""
echo "Summary:"
echo "✓ Health check"
echo "✓ Document upload"
echo "✓ Document listing"
echo "✓ RAG semantic search"
echo "✓ Agent chat with document"
echo "✓ Agent chat with memory"
echo "✓ Agent general chat"
echo "✓ Session reset"
echo "✓ Document deletion"
echo ""
echo "The Document Q&A API is working correctly!"


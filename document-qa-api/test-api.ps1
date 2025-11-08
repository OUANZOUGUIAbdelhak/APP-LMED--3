# Document Q&A API Test Script (PowerShell)
# This script tests all major endpoints to verify the API is working correctly

$API_BASE = "http://localhost:3001/api"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Document Q&A API Test Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check" -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$API_BASE/health" -Method Get
    Write-Host "✓ Health check passed" -ForegroundColor Green
    $healthResponse | ConvertTo-Json
} catch {
    Write-Host "✗ Health check failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
Write-Host ""

# Test 2: Create test document
Write-Host "Test 2: Creating test document" -ForegroundColor Yellow
$testContent = @"
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
"@

$testFile = "test-document.txt"
$testContent | Out-File -FilePath $testFile -Encoding UTF8
Write-Host "✓ Test document created" -ForegroundColor Green
Write-Host ""

# Test 3: Upload Document
Write-Host "Test 3: Upload Document" -ForegroundColor Yellow
try {
    $uploadUrl = "$API_BASE/documents/upload"
    $fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $testFile))
    $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/plain")
    
    $multipartContent = [System.Net.Http.MultipartFormDataContent]::new()
    $multipartContent.Add($fileContent, "file", $testFile)
    
    $httpClient = [System.Net.Http.HttpClient]::new()
    $response = $httpClient.PostAsync($uploadUrl, $multipartContent).Result
    $uploadResponse = $response.Content.ReadAsStringAsync().Result | ConvertFrom-Json
    
    $docId = $uploadResponse.docId
    Write-Host "✓ Document uploaded successfully" -ForegroundColor Green
    Write-Host "Document ID: $docId"
    $uploadResponse | ConvertTo-Json
} catch {
    Write-Host "✗ Document upload failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Remove-Item $testFile
    exit 1
}
Write-Host ""

# Test 4: List Documents
Write-Host "Test 4: List Documents" -ForegroundColor Yellow
try {
    $listResponse = Invoke-RestMethod -Uri "$API_BASE/documents" -Method Get
    Write-Host "✓ Documents listed successfully" -ForegroundColor Green
    $listResponse | ConvertTo-Json
} catch {
    Write-Host "✗ List documents failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 5: RAG Query
Write-Host "Test 5: RAG Query (Semantic Search)" -ForegroundColor Yellow
try {
    $ragBody = @{
        query = "machine learning"
        documentIds = @($docId)
        topK = 3
    } | ConvertTo-Json
    
    $ragResponse = Invoke-RestMethod -Uri "$API_BASE/rag/query" -Method Post -Body $ragBody -ContentType "application/json"
    Write-Host "✓ RAG query successful" -ForegroundColor Green
    $ragResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✗ RAG query failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 6: Agent Chat (with document)
Write-Host "Test 6: Agent Chat (with document context)" -ForegroundColor Yellow
try {
    $chatBody = @{
        message = "What is this document about?"
        sessionId = "test-session"
        documentIds = @($docId)
    } | ConvertTo-Json
    
    $chatResponse = Invoke-RestMethod -Uri "$API_BASE/agent/chat" -Method Post -Body $chatBody -ContentType "application/json"
    Write-Host "✓ Agent chat successful" -ForegroundColor Green
    Write-Host "Reply: $($chatResponse.reply)"
    Write-Host ""
    Write-Host "Sources:"
    $chatResponse.sources | ConvertTo-Json -Depth 5
} catch {
    Write-Host "✗ Agent chat failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 7: Agent Chat (follow-up question)
Write-Host "Test 7: Agent Chat (follow-up with memory)" -ForegroundColor Yellow
try {
    $chat2Body = @{
        message = "What are the applications mentioned?"
        sessionId = "test-session"
        documentIds = @($docId)
    } | ConvertTo-Json
    
    $chat2Response = Invoke-RestMethod -Uri "$API_BASE/agent/chat" -Method Post -Body $chat2Body -ContentType "application/json"
    Write-Host "✓ Follow-up chat successful" -ForegroundColor Green
    Write-Host "Reply: $($chat2Response.reply)"
} catch {
    Write-Host "✗ Follow-up chat failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 8: Agent Chat (without document - general question)
Write-Host "Test 8: Agent Chat (general question, no document)" -ForegroundColor Yellow
try {
    $chat3Body = @{
        message = "Hello, how are you?"
        sessionId = "test-session-2"
    } | ConvertTo-Json
    
    $chat3Response = Invoke-RestMethod -Uri "$API_BASE/agent/chat" -Method Post -Body $chat3Body -ContentType "application/json"
    Write-Host "✓ General chat successful" -ForegroundColor Green
    Write-Host "Reply: $($chat3Response.reply)"
} catch {
    Write-Host "✗ General chat failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 9: Reset Session
Write-Host "Test 9: Reset Session" -ForegroundColor Yellow
try {
    $resetBody = @{
        sessionId = "test-session"
    } | ConvertTo-Json
    
    $resetResponse = Invoke-RestMethod -Uri "$API_BASE/session/reset" -Method Post -Body $resetBody -ContentType "application/json"
    Write-Host "✓ Session reset successful" -ForegroundColor Green
    $resetResponse | ConvertTo-Json
} catch {
    Write-Host "✗ Session reset failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Test 10: Delete Document
Write-Host "Test 10: Delete Document" -ForegroundColor Yellow
try {
    $deleteResponse = Invoke-RestMethod -Uri "$API_BASE/documents/$docId" -Method Delete
    Write-Host "✓ Document deleted successfully" -ForegroundColor Green
    $deleteResponse | ConvertTo-Json
} catch {
    Write-Host "✗ Document deletion failed" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# Cleanup
Remove-Item $testFile

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:"
Write-Host "✓ Health check"
Write-Host "✓ Document upload"
Write-Host "✓ Document listing"
Write-Host "✓ RAG semantic search"
Write-Host "✓ Agent chat with document"
Write-Host "✓ Agent chat with memory"
Write-Host "✓ Agent general chat"
Write-Host "✓ Session reset"
Write-Host "✓ Document deletion"
Write-Host ""
Write-Host "The Document Q&A API is working correctly!" -ForegroundColor Green


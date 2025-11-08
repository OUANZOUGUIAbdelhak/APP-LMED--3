# Quick RAG Debug Script for Windows PowerShell

Write-Host "`n🔍 RAG System Debug Test`n" -ForegroundColor Cyan

# Test 1: Check if backend is running
Write-Host "Test 1: Checking backend health..." -ForegroundColor Yellow
try {
    $health = curl http://localhost:3001/api/health 2>$null | ConvertFrom-Json
    Write-Host "✅ Backend is running!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
    Write-Host "   RAG Enabled: $($health.rag_enabled)" -ForegroundColor White
    Write-Host "   Documents Indexed: $($health.document_count)" -ForegroundColor $(if($health.document_count -gt 0){"Green"}else{"Red"})
    Write-Host "   Groq Configured: $($health.groqConfigured)" -ForegroundColor White
    
    if ($health.document_count -eq 0) {
        Write-Host "`n⚠️  WARNING: No documents indexed!" -ForegroundColor Red
        Write-Host "   You need to upload files first!" -ForegroundColor Yellow
    } else {
        Write-Host "`n✅ Documents are indexed! RAG should work." -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Backend not running!" -ForegroundColor Red
    Write-Host "   Start it with: cd server; npm i; npm run dev" -ForegroundColor Yellow
    exit
}

# Test 2: Check if frontend is running
Write-Host "`nTest 2: Checking frontend..." -ForegroundColor Yellow
try {
    $response = curl http://localhost:5173 2>$null
    Write-Host "✅ Frontend is running!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Frontend might not be running" -ForegroundColor Yellow
    Write-Host "   Start it with: npm run dev" -ForegroundColor Yellow
}

# Test 3: Create a test file
Write-Host "`nTest 3: Creating test file..." -ForegroundColor Yellow
$testContent = @"
Abdelhak Ouanzzougui

Background:
Abdelhak Ouanzzougui is a talented software engineer with expertise in artificial intelligence and machine learning.
He specializes in building RAG (Retrieval-Augmented Generation) systems using LlamaIndex and vector databases.

Skills:
- Python programming
- LlamaIndex and LangChain
- Vector databases (ChromaDB, FAISS)
- Natural language processing
- Machine learning and deep learning

Education:
Abdelhak studied computer science and has a strong background in AI research.

Projects:
He has worked on various projects involving document analysis, question answering systems, and intelligent chatbots.
"@

$testFile = "test_abdelhak.txt"
$testContent | Out-File -FilePath $testFile -Encoding UTF8
Write-Host "✅ Created $testFile" -ForegroundColor Green
Write-Host "   Location: $(Get-Location)\$testFile" -ForegroundColor White

# Instructions
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Open your browser: http://localhost:5173" -ForegroundColor White
Write-Host "2. Click 'Upload File' in the left sidebar" -ForegroundColor White
Write-Host "3. Select '$testFile'" -ForegroundColor White
Write-Host "4. Wait for upload to complete (10-20 seconds)" -ForegroundColor White
Write-Host "5. Ask in chat: 'What is Abdelhak's background?'" -ForegroundColor White
Write-Host "`n6. Watch the backend terminal for this output:" -ForegroundColor Yellow
Write-Host "   🔧 use_rag: True" -ForegroundColor Gray
Write-Host "   📊 Document count: 1" -ForegroundColor Gray
Write-Host "   🔍 Querying with RAG..." -ForegroundColor Gray

Write-Host "`n💡 If RAG still doesn't work:" -ForegroundColor Yellow
Write-Host "1. Stop both servers (Ctrl+C)" -ForegroundColor White
Write-Host "2. Delete index: Remove file server\data\index.json" -ForegroundColor White
Write-Host "3. Restart backend: cd server; npm run dev" -ForegroundColor White
Write-Host "4. Restart frontend: npm run dev" -ForegroundColor White
Write-Host "5. Upload $testFile again" -ForegroundColor White

Write-Host "`n📖 Backend lives in the 'server' folder; set GROQ_API_KEY in server/.env`n" -ForegroundColor Cyan


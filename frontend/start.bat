@echo off
chcp 65001 >nul
title APG Flight Agent v2.2

echo.
echo =====================================================
echo   APG FLIGHT AGENT v2.2 - Tan Phu APG
echo =====================================================
echo.

:: Kiem tra Node.js
echo [1/3] Kiem tra Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo.
    echo  LOI: Khong tim thay Node.js!
    echo  --> Tai va cai dat tai: https://nodejs.org
    echo  --> Chon phien ban LTS (Long Term Support)
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo   OK - Node.js: %%i

:: Cai dependencies neu chua co
echo [2/3] Kiem tra dependencies...
if not exist node_modules (
    echo   Dang cai dat npm packages... (lan dau ~1-2 phut)
    call npm install
    if errorlevel 1 (
        echo.
        echo   LOI: npm install that bai!
        echo   Thu chay lai hoac kiem tra ket noi mang.
        echo.
        pause
        exit /b 1
    )
    echo   Cai dat xong!
) else (
    echo   node_modules da co san.
)

:: Tao .env.local neu chua co
echo [3/3] Kiem tra cau hinh...
if not exist .env.local (
    copy .env.example .env.local >nul
    echo   Da tao .env.local (ABAY_MOCK=false = se scrape abay.vn thuc)
) else (
    echo   .env.local da ton tai.
)

echo.
echo =====================================================
echo   SERVER DANG KHOI DONG...
echo.
echo   Sau khi thay dong: "Ready in Xms"
echo   Mo trinh duyet vao: http://localhost:3000
echo.
echo   Nhan Ctrl+C de dung server
echo =====================================================
echo.

call npm run dev

:: Neu den duoc dong nay = co loi xay ra
echo.
echo Server da dung hoac gap loi.
pause

@echo off
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다. Node.js 18 이상을 설치한 뒤 다시 실행하세요.
  pause
  exit /b 1
)
if not exist node_modules (
  echo 처음 실행이라 필요한 패키지를 설치합니다...
  call npm install
)
echo.
echo 서버를 시작합니다. 같은 Wi-Fi의 휴대폰에서 이 PC의 IP주소:3000 으로 접속하세요.
echo 종료하려면 Ctrl+C
call npm start
pause

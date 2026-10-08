# Render 무료 배포 가이드

이 프로젝트는 Node.js + Express + Socket.IO 웹서비스이므로 Static Site가 아니라 **Web Service**로 배포해야 합니다.

## 준비
1. ZIP 압축을 풉니다.
2. GitHub에 새 저장소를 만듭니다.
3. 압축을 푼 `one-night-mobile` 폴더의 **내용물**을 저장소 루트에 올립니다.
   - `server.js`
   - `package.json`
   - `game-engine.js`
   - `render.yaml`
   - `public/` 폴더
   - 기타 파일

중요: GitHub에서 `render.yaml`과 `package.json`이 저장소 최상위에 보여야 합니다.

## Render 배포
1. https://render.com 에 로그인합니다.
2. GitHub 계정을 연결합니다.
3. Dashboard에서 **New > Blueprint**를 선택합니다.
4. 위에서 만든 GitHub 저장소를 선택합니다.
5. Render가 루트의 `render.yaml`을 읽는 것을 확인합니다.
6. 서비스 계획이 **Free**, 리전이 **Singapore**인지 확인합니다.
7. Apply/Deploy를 누릅니다.
8. 배포 성공 후 만들어진 `https://...onrender.com` 주소를 엽니다.
9. 친구들에게 같은 주소를 보내고 방 코드로 접속하면 됩니다.

## 무료 Render 주의점
- 15분 동안 HTTP 요청이나 WebSocket 메시지가 전혀 없으면 서비스가 sleep될 수 있습니다.
- 다시 접속하면 자동으로 켜지지만 첫 접속이 잠시 느릴 수 있습니다.
- 방/게임 상태는 서버 메모리에만 있으므로 서버가 재시작되면 진행 중인 방은 사라집니다.
- 친구끼리 가끔 하는 용도에는 충분합니다.

## 업데이트
GitHub 저장소에 코드를 수정해서 push하면 Render가 연결된 브랜치를 다시 배포할 수 있습니다.

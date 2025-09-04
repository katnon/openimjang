# 🔥 Firebase 설정 가이드

Firebase 인증 시스템이 구현되었지만, Firebase 프로젝트의 설정값들을 환경변수에 추가해야 합니다.

## 📋 필요한 작업

### 1. Firebase 콘솔에서 설정값 확인하기

1. [Firebase 콘솔](https://console.firebase.google.com) 접속
2. 생성한 프로젝트 선택
3. 왼쪽 사이드바에서 ⚙️ **설정** → **프로젝트 설정** 클릭
4. **일반** 탭에서 **내 앱** 섹션 확인
5. **웹 앱**이 없다면 **앱 추가** → **웹** 선택해서 추가
6. **SDK 설정 및 구성** 섹션에서 `firebaseConfig` 객체의 값들을 확인

### 2. 환경변수 설정하기

`apps/web/.env.local` 파일에서 다음 값들을 실제 Firebase 설정값으로 교체하세요:

```bash
# Firebase 설정값을 여기에 입력하세요
VITE_FIREBASE_API_KEY=실제_API_키
VITE_FIREBASE_AUTH_DOMAIN=프로젝트ID.firebaseapp.com  
VITE_FIREBASE_PROJECT_ID=실제_프로젝트ID
VITE_FIREBASE_STORAGE_BUCKET=프로젝트ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=실제_sender_id
VITE_FIREBASE_APP_ID=실제_앱_id
```

### 3. Firebase 콘솔에서 인증 설정 확인

1. Firebase 콘솔 → **Authentication** → **Sign-in method** 탭
2. **이메일/비밀번호** 인증이 **사용 설정됨**으로 되어있는지 확인
3. 비활성화되어 있다면 클릭해서 활성화

### 4. Google 소셜 로그인 설정 (추가됨!)

1. Firebase 콘솔 → **Authentication** → **Sign-in method** 탭
2. **Google** 제공업체 찾아서 클릭
3. **사용 설정됨** 토글을 ON으로 변경
4. **프로젝트 지원 이메일** 선택 (본인 Gmail 주소)
5. **저장** 버튼 클릭
6. 승인된 도메인에 `localhost`가 포함되어 있는지 확인
   - 없다면 **승인된 도메인** 탭에서 `localhost` 추가

### 5. 개발 서버 재시작

환경변수를 변경했으므로 개발 서버를 재시작해주세요:

```bash
# 현재 실행중인 개발서버들을 중지하고 다시 시작
cd apps/web
npm run dev
```

## 🎯 설정 완료 후 테스트

### 이메일/비밀번호 로그인 테스트:
1. 브라우저에서 OpenImjang 열기
2. 우측 상단의 **로그인** 버튼 클릭
3. **회원가입** 탭에서 테스트 계정 생성
4. 로그인 성공 시 사용자 아이콘과 이메일이 표시됨

### Google 소셜 로그인 테스트:
1. 로그인 모달에서 **"Google로 계속하기"** 버튼 클릭
2. Google 로그인 팝업 창이 열림
3. Google 계정으로 로그인
4. 자동으로 모달이 닫히고 사용자 정보가 표시됨

## 🔧 문제 해결

### Firebase 설정 오류가 발생할 때:
- 브라우저 개발자도구 콘솔에서 오류 메시지 확인
- Firebase 프로젝트 설정값이 정확한지 재확인
- 환경변수명이 `VITE_` 접두사로 시작하는지 확인

### 인증이 작동하지 않을 때:
- Firebase Authentication이 활성화되어 있는지 확인
- 이메일/비밀번호 로그인이 허용되어 있는지 확인
- 네트워크 연결 상태 확인

## 🎉 구현된 기능

✅ **완료된 기능들:**
- Firebase 인증 시스템 통합
- 로그인/회원가입 모달 UI
- 인증 상태별 TopBar UI 변경 
- 사용자 메뉴 (프로필, 설정, 로그아웃)
- 전역 인증 상태 관리
- 자동 토큰 관리 (API 요청시 자동 첨부)

🚀 **다음 단계로 구현 가능한 기능들:**
- ~~Google 소셜 로그인~~ ✅ **완료!**
- 비밀번호 재설정
- 이메일 인증
- 사용자 프로필 관리
- 로그인 기록 관리

환경변수 설정이 완료되면 Firebase 인증 시스템을 테스트해보세요!
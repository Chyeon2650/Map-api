# 사이 · 두 장소 사이의 거리

Nominatim으로 출발지와 도착지를 조회하고 자동차 경로 거리 또는 직선거리를 확인하는 한국어 웹앱입니다. Next.js App Router + TypeScript로 작성했으며 GitHub 저장소를 Vercel에 Import해서 배포합니다.

## 기능

- 출발지·도착지의 장소명/주소 검색, 최대 5개 결과 중 직접 선택
- 검색 결과의 전체 주소 확인, 선택한 장소만 거리 계산에 사용
- 자동차 도로 경로의 총거리·예상 시간: OSRM / FOSSGIS
- 직선거리: 선택한 두 좌표로 Haversine 계산
- 총거리 아래 **지도에서 보기**: 자동차 모드는 OpenStreetMap 길찾기, 직선 모드는 두 지점이 포함된 지도 영역을 새 탭에서 표시
- 출발지·도착지 교환, 입력 변경 시 이전 결과 초기화, 검색 실패·경로 없음·요청 제한 안내
- 모바일 화면, 키보드 Enter 검색, 선택 상태와 오류 안내

오른쪽 그림은 경로 개요입니다. 배경 지도나 내비게이션이 아니며, 정확한 지도는 결과의 링크에서 확인합니다. 자동차 예상 시간은 실시간 교통을 반영하지 않습니다. 지도 사이트의 데이터 갱신이나 도로 스냅에 따라 링크에서 다시 계산한 값은 다를 수 있습니다. Nominatim 데이터에 없는 장소는 검색되지 않으며, 이름이 같은 장소는 주소를 보고 선택해야 합니다.

## 로컬 실행

Node.js 22 이상과 npm이 필요합니다.

```powershell
npm ci
npm run dev
```

http://localhost:3000 에 접속합니다. 개발 모드에서는 메모리 캐시와 단일 프로세스 요청 제한을 사용하므로 환경변수 없이 확인할 수 있습니다. 검색창에 `서울역`을 입력하고 검색을 누른 다음 결과를 선택합니다. 도착지도 같은 방법으로 선택한 후 거리 계산하기를 누릅니다. 공개 API에 자동완성 요청을 보내지 않습니다.

## GitHub → Vercel 배포

1. GitHub에 빈 저장소를 만들고 이 폴더의 소스를 올립니다. `node_modules`, `.next`, `.env.local`은 올리지 않습니다. `package-lock.json`은 함께 올립니다.
2. Upstash에서 Redis 데이터베이스를 만들고 **REST URL**과 **REST Token**을 복사합니다. Vercel Marketplace의 Upstash 통합을 사용해도 됩니다. Redis가 여러 곳에서 사용된다면 이 앱에 전용 데이터베이스를 권장합니다.
3. Vercel에서 **Add New → Project → Import Git Repository**로 저장소를 선택합니다.
4. Framework Preset은 **Next.js**, Root Directory는 이 프로젝트 루트, Build Command는 `npm run build`로 둡니다. Output Directory는 기본값을 유지하고 Node.js는 22 이상을 선택합니다.
5. 아래 환경변수를 **Production과 Preview 모두**에 설정합니다. 공개 API의 앱 전체 제한을 공유하려면 모든 배포가 같은 Redis 데이터베이스를 사용해야 합니다.
6. Deploy합니다. 환경변수를 나중에 바꾸면 Redeploy합니다. 배포 주소에서 출발지와 도착지를 직접 검색해 확인합니다.

| 환경변수 | 필수 | 값 |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | 공개 배포 필수 | Upstash Redis의 HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 공개 배포 필수 | Upstash의 쓰기 가능한 REST Token. Readonly Token 아님 |
| `APP_USER_AGENT` | 공개 배포 필수 | 예: `BetweenDistance/1.0 (+https://your-project.vercel.app)` 또는 실제 운영자 연락 이메일을 포함한 식별자 |
| `NOMINATIM_BASE_URL` | 선택 | 기본 `https://nominatim.openstreetmap.org` |
| `OSRM_BASE_URL` | 선택 | 기본 `https://routing.openstreetmap.de/routed-car` |

자동으로 제공되는 `VERCEL_URL`과 별개로 `APP_USER_AGENT`를 직접 지정합니다. 아직 도메인이 없으면 운영자 연락 이메일을 먼저 사용해도 됩니다. 서버 환경변수에 `NEXT_PUBLIC_`를 붙이지 마세요. Redis 토큰은 서버에서만 사용합니다. `.env.example`에 설정 예시가 있습니다. 로컬 환경변수는 `.env.local`에 저장합니다.

Redis와 앱 식별자가 빠진 공개 배포에서는 외부 API 요청을 보내지 않고 설정 안내를 표시합니다. 따라서 **GitHub Import에 더해 위 환경변수 설정이 필요합니다.** `npm run build` 자체에는 외부 API나 Redis 연결이 필요하지 않습니다. `npm run start`는 운영 모드이므로 로컬에서도 위 설정이 필요하고, 개발용 확인은 `npm run dev`를 사용합니다.

## 공개 API 정책과 운영 범위

**Nominatim 공개 서비스는 앱 전체 초당 최대 1회, 사용자 동작에 따른 조회, 식별 가능한 User-Agent, 출처 표시를 요구하며 입력 중 자동완성을 금지합니다.** 운영자는 [Nominatim 사용 정책](https://operations.osmfoundation.org/policies/nominatim/)을 확인하고 준수해야 합니다. 공개 API는 적당한 사용자 수의 가벼운 사용을 위한 서비스입니다.

이 앱은 다음과 같이 제한합니다.

- 검색 버튼/Enter 동작으로만 조회합니다. 입력만으로 검색하지 않습니다.
- 검색어 정규화 후 결과를 24시간 캐시합니다. 경로 결과는 1시간 캐시합니다.
- Redis의 원자적 `SET NX PX`로 API 호스트별 앱 전체 요청을 잠급니다. 외부 요청 종료 후에도 1.1초 동안 잠금을 유지합니다. 잠금 중 다른 요청은 429와 재시도 안내를 받으며 자동 재시도하지 않습니다.
- 외부 API는 8초, Redis 요청은 4초로 시간 제한합니다. Redis 장애가 나면 외부 호출을 중단합니다. 개발용 메모리 제한으로 자동 우회하지 않습니다.
- API 호스트별 제한은 모든 사용자, Production/Preview 및 서버리스 인스턴스에서 같은 Redis로 공유됩니다. 같은 제공자를 호출하는 다른 앱도 운영한다면 총량이 제한을 넘지 않도록 공통 제한을 사용해야 합니다.
- Nominatim/OSRM 호환 제공자의 주소는 환경변수로 교체할 수 있습니다. 트래픽이 늘면 전용 또는 상용 제공자로 바꾸세요. 다른 API 형식의 제공자는 어댑터 수정이 필요합니다.

공개 경로 서버도 [FOSSGIS 사용 안내](https://routing.openstreetmap.de/about.html)에 따라 초당 1회 이하로 사용하며 대량 사용과 서비스 보장을 전제로 하지 않습니다. 앱에 OpenStreetMap 저작자, OSRM/FOSSGIS, 지도 수정 링크를 표시합니다.

검색어는 Nominatim에, 경로 좌표는 OSRM에 전달되며 해당 제공자의 로그에 남을 수 있습니다. 검색어 원문은 캐시 키에서 SHA-256으로 변환하고, 선택 후보와 경로는 서버/Redis에 일시 캐시됩니다. 사용자에게 검색창으로 민감한 개인정보를 입력하도록 요구하지 마세요. 공개 운영 시 Redis 사용량과 Vercel 요청량도 확인하세요.

## 검증

```powershell
npm test
npm run build
npm run typecheck
```

거리 계산 경계값, 좌표 검증, 지도 링크, 캐시, 동시 요청 제한, Redis 장애 시 중단, 검색 결과 변환, 경로 실패를 검증합니다. 단위 테스트는 외부 서비스를 모의 응답으로 대체합니다.

브라우저 통합 테스트는 최초에 `npx playwright install chromium`으로 브라우저를 설치하고 `npx playwright test`로 실행합니다. 설치된 Chrome을 쓰려면 PowerShell에서 `$env:PLAYWRIGHT_CHANNEL = 'chrome'`을 설정한 뒤 실행합니다. 검색의 수동 실행, 결과 선택, 지도 링크, 모바일 레이아웃, 경로 실패를 확인하며 API는 모의 응답을 사용합니다.

## 파일 구성

- `src/app/page.tsx`: 입력·선택·거리 결과 화면
- `src/components/place-search.tsx`: 사용자 동작에 따른 검색과 결과 선택
- `src/app/api/search/route.ts`: Nominatim 프록시
- `src/app/api/route/route.ts`: OSRM 자동차 경로 프록시
- `src/lib/providers.ts`: 공용 캐시, 분산 요청 제한, 외부 서비스 설정
- `src/lib/distance.ts`: 직선거리, 단위, 지도 링크

참고: [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/), [OSRM API](https://project-osrm.org/docs/v5.24.0/api/), [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

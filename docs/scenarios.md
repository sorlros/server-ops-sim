# MVP Scenarios

## 1. Disk Full

- 증상: 배포 실패, API 지연, DB write 실패
- 원인: `/var/log/app.log` 폭증으로 `/var` 98%
- 관측: `df -h`, `du -sh /var/log/*`, `journalctl -u app`
- 조치: `truncate -s 0 /var/log/app.log`, `logrotate -f /etc/logrotate.d/app`
- 검증: `curl -f http://localhost/health`

## 2. Memory / OOM

- 증상: 앱 재시작, OOM 로그
- 원인: worker 메모리 누수
- 관측: `free -m`, `top`, `dmesg | tail`
- 조치: `systemctl restart worker` 또는 문제 PID 종료
- 검증: health check 정상

## 3. CPU Spike

- 증상: API latency 상승, load average 급증
- 원인: 검색 인덱스 재빌드 배치와 실시간 트래픽 충돌
- 관측: `top`, `ps aux --sort=-%cpu`
- 조치: `kill 3307`
- 검증: CPU 사용률 정상화

## 4. Nginx 502

- 증상: 외부 사용자는 502, 앱은 실행 중
- 원인: Nginx upstream 포트와 앱 포트 불일치
- 관측: `systemctl status nginx`, `nginx -t`, `ss -ltnp`
- 조치: `fix-nginx-upstream`, `systemctl reload nginx`
- 검증: health check 정상

## 5. DB Connection Exhaustion

- 증상: API timeout, too many connections
- 원인: idle in transaction 세션과 과도한 앱 풀
- 관측: `psql connections`, `psql long-transactions`
- 조치: `terminate-idle-transactions`, `tune-db-pool`, `systemctl restart app`
- 검증: 대기 클라이언트 0, 앱 정상

## 6. Bad Deployment / Rollback

- 증상: 배포 후 500 에러율 급증
- 원인: 필수 환경변수 누락
- 관측: `deploy status`, `journalctl -u app`
- 조치: `deploy rollback`
- 검증: 이전 정상 버전 health check 통과
